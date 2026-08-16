

"use client";

import * as React from "react";
import { useState, useMemo, useCallback } from "react";
import type { Journal } from "@/data/journals";
import { AjiLogo } from "@/components/brand/AjiLogo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ArrowLeft, BookOpen, Menu, Folder, Download, Pencil, X, Check, Trash2, FolderSync, Heart, Info, Star, Search as SearchIcon } from "lucide-react";
import JournalDetail from "./JournalDetail";
import SearchPage from "./SearchPage";
import CategoryStats from "./CategoryStats";
import CategoryBrowse from "./CategoryBrowse";
import UserAvatar from "../auth/UserAvatar";
import { useFirebase } from "@/firebase";
import FavoritesContent, { JournalList } from "../favorites/FavoritesContent";
import AboutPage from "./AboutPage";
import { ThemeToggle } from "../theme/ThemeToggle";
import { LanguageToggle } from "../theme/LanguageToggle";
import { useTranslation } from "@/i18n/provider";
import { getMajorCategoryName } from "@/i18n/categories";
import { useCollection, WithId } from "@/firebase/firestore/use-collection";
import { collection, query, writeBatch, doc, getDocs, where, serverTimestamp, orderBy } from "firebase/firestore";
import { useMemoFirebase } from "@/firebase/provider";
import LoginDialog from "../auth/LoginDialog";
import JournalListItem from "./JournalListItem";
import { useIsMobile } from "@/hooks/use-mobile";
import Papa from "papaparse";
import { Checkbox } from "../ui/checkbox";
import AddToFavoritesDialog from "../favorites/AddToFavoritesDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useEdition } from "@/contexts/EditionContext";
import { usePartitionTerminology } from "@/hooks/use-partition-terminology";
import { editionHasPartition } from "@/data/edition-utils";
import { getPrimaryIssn } from "@/lib/issn";
import EditionSwitcher from "@/components/edition/EditionSwitcher";

const JOURNALS_PER_PAGE = 20;

// Helper function to generate pagination items
const getPaginationItems = (
  currentPage: number,
  totalPages: number,
  onPageChange: (page: number) => void,
  isMobile: boolean = false
) => {
  const range = (start: number, end: number) => {
    if (start > end) return [];
    const length = end - start + 1;
    return Array.from({ length }, (_, i) => start + i);
  };

  const renderPage = (pageNumber: number) => (
    <PaginationItem key={pageNumber}>
      <PaginationLink
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onPageChange(pageNumber);
        }}
        isActive={currentPage === pageNumber}
      >
        {pageNumber}
      </PaginationLink>
    </PaginationItem>
  );

  if (isMobile) {
    if (totalPages <= 5) {
      return range(1, totalPages).map(p => renderPage(p));
    }
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
    if (currentPage <= 2) {
      startPage = 1;
      endPage = 5;
    }
    if (currentPage > totalPages - 3) {
      startPage = totalPages - 4;
      endPage = totalPages;
    }
    return range(startPage, endPage).map(p => renderPage(p));
  }
  
  const pages: React.ReactNode[] = [];
  const pageLimit = 3; 
  const middleLimit = 7; 

  const renderEllipsis = (key: string) => (
    <PaginationItem key={key}>
      <PaginationEllipsis />
    </PaginationItem>
  );

  if (totalPages <= 2 * pageLimit + middleLimit - 2) {
    return range(1, totalPages).map((p) => renderPage(p));
  }

  // Start pages
  pages.push(...range(1, pageLimit).map((p) => renderPage(p)));

  // Ellipsis or middle pages
  const middleStart = Math.max(pageLimit + 1, currentPage - Math.floor((middleLimit - 1) / 2));
  const middleEnd = Math.min(totalPages - pageLimit, currentPage + Math.floor((middleLimit - 1) / 2));

  if (middleStart > pageLimit + 1) {
    pages.push(renderEllipsis("start-ellipsis"));
  }

  pages.push(...range(middleStart, middleEnd).map((p) => renderPage(p)));
  
  if (middleEnd < totalPages - pageLimit) {
     pages.push(renderEllipsis("end-ellipsis"));
  }

  // End pages
  pages.push(...range(totalPages - pageLimit + 1, totalPages).map((p) => renderPage(p)));

  // De-duplicate pages
  const pageKeys = new Set();
  const uniquePages = pages.filter(item => {
    if (React.isValidElement(item)) {
        if (!pageKeys.has(item.key)) {
            pageKeys.add(item.key);
            return true;
        }
    }
    return false;
  });

  return uniquePages;
};


const extractRank = (partition: string): number => {
  const match = partition.match(/(\d+)\//);
  return match ? parseInt(match[1], 10) : Infinity;
};

type FavoriteJournalEntry = {
  journalId: string;
  listId?: string;
};

const triggerCsvDownload = (data: (string | number)[][], filename: string) => {
  const csvContent = "data:text/csv;charset=utf-8," + Papa.unparse(data);
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link); // Required for FF
  link.click();
  document.body.removeChild(link);
};


export default function CategoryPage() {
  const { journals, currentEditionId, currentEdition } = useEdition();
  const { exportPartitionHeader, hasPartition } = usePartitionTerminology();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [journalHistory, setJournalHistory] = useState<Journal[]>([]);
  const [selectedJournalList, setSelectedJournalList] = useState<WithId<JournalList> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [view, setView] = useState<'search' | 'categories' | 'favorites' | 'about'>("search");
  const { user, firestore } = useFirebase();
  const { t, locale } = useTranslation();
  
  const [preservedSearchTerm, setPreservedSearchTerm] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  
  // Batch edit state
  const [isEditing, setIsEditing] = useState(false);
  const [selectedJournals, setSelectedJournals] = useState<Set<string>>(new Set());
  const [isAddToFavoritesOpen, setIsAddToFavoritesOpen] = useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  const selectedJournal = journalHistory.length > 0 ? journalHistory[journalHistory.length - 1] : null;

  React.useEffect(() => {
    setSelectedCategory(null);
    setJournalHistory([]);
    setSelectedJournalList(null);
    setCurrentPage(1);
    setPreservedSearchTerm("");
    setIsEditing(false);
    setSelectedJournals(new Set());
  }, [currentEditionId]);

  React.useEffect(() => {
    if (!editionHasPartition(currentEdition) && view === "categories") {
      setView("search");
    }
  }, [currentEdition, view]);

  const categories = useMemo(() => {
    const categoryCounts: { [key: string]: number } = {};
    journals.forEach((journal) => {
      if (journal.majorCategory) {
        categoryCounts[journal.majorCategory] =
          (categoryCounts[journal.majorCategory] || 0) + 1;
      }
    });
    return categoryCounts;
  }, [journals]);

  const sortedCategories = useMemo(() => {
    return Object.entries(categories).sort(
      ([, countA], [, countB]) => countB - countA
    );
  }, [categories]);

  const journalMap = useMemo(() => new Map(journals.map(j => [getPrimaryIssn(j.issn), j])), [journals]);

  // For Favorites view - get all favorite journal IDs first
  const allFavoritesQuery = useMemoFirebase(
      () =>
        user && firestore
          ? query(collection(firestore, `users/${user.uid}/favorite_journals`))
          : null,
      [user, firestore]
  );
  const { data: allFavoriteEntries } = useCollection<FavoriteJournalEntry>(allFavoritesQuery);

  const journalListsQuery = useMemoFirebase(
      () =>
        user && firestore
          ? query(
              collection(firestore, `users/${user.uid}/journal_lists`),
              orderBy("name", "asc")
            )
          : null,
      [user, firestore]
  );
  const { data: journalLists, isLoading: isLoadingLists } = useCollection<JournalList>(journalListsQuery);

  // For Browse view
  const journalsForCategory = useMemo(() => {
    if (!selectedCategory) return [];

    // Regular category logic from all journals
    return journals
      .filter((j) => j.majorCategory === selectedCategory)
      .sort((a, b) => {
        const rankA = extractRank(a.majorCategoryPartition);
        const rankB = extractRank(b.majorCategoryPartition);
        return rankA - rankB;
      });
  }, [journals, selectedCategory]);

  // For Favorites list view
  const favoriteJournalIdsInList = useMemo(() => {
    if (!selectedJournalList || !allFavoriteEntries) return [];
    return allFavoriteEntries
      .filter(fav => fav.listId === selectedJournalList.id)
      .map(fav => fav.journalId);
  }, [selectedJournalList, allFavoriteEntries]);

  const journalsForList = useMemo(() => {
    return favoriteJournalIdsInList
      .map(id => journalMap.get(id))
      .filter((j): j is Journal => !!j)
      .sort((a, b) => {
        const factorA = typeof a.impactFactor === 'number' ? a.impactFactor : 0;
        const factorB = typeof b.impactFactor === 'number' ? b.impactFactor : 0;
        return factorB - factorA;
      });
  }, [favoriteJournalIdsInList, journalMap]);

  const journalsToDisplay = selectedJournalList ? journalsForList : journalsForCategory;

  const paginatedJournals = useMemo(() => {
    const startIndex = (currentPage - 1) * JOURNALS_PER_PAGE;
    return journalsToDisplay.slice(
      startIndex,
      startIndex + JOURNALS_PER_PAGE
    );
  }, [journalsToDisplay, currentPage]);

  const totalPages = Math.ceil(journalsToDisplay.length / JOURNALS_PER_PAGE);

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
    setJournalHistory([]);
    setSelectedJournalList(null);
    setIsEditing(false);
    setSelectedJournals(new Set());
  };
  
  const handleJournalListSelect = (list: WithId<JournalList>) => {
    setSelectedJournalList(list);
    setSelectedCategory(null);
    setCurrentPage(1);
    setJournalHistory([]);
    setIsEditing(false);
    setSelectedJournals(new Set());
  }

  const handleJournalSelect = (journal: Journal, searchTerm: string = "") => {
    if (view === 'search') {
      setPreservedSearchTerm(searchTerm);
    }
    if (isEditing) {
        handleSelectionChange(getPrimaryIssn(journal.issn), !selectedJournals.has(getPrimaryIssn(journal.issn)));
    } else {
        setJournalHistory([journal]);
    }
  };

  const handleJournalSelectByName = useCallback(
    (journalName: string) => {
      const journal = journals.find((j) => j.journalName === journalName);
      if (journal) {
        setJournalHistory(prev => [...prev, journal]);
        window.scrollTo(0, 0);
      }
    },
    [journals]
  );

  const handleBackToList = () => {
    setSelectedCategory(null);
    setJournalHistory([]);
    setSelectedJournalList(null);
    setIsEditing(false);
    setSelectedJournals(new Set());
  };

  const handleBackFromDetail = () => {
    if (journalHistory.length > 1) {
        setJournalHistory(prev => prev.slice(0, -1));
    } else {
        setJournalHistory([]);
    }
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo(0, 0);
    }
  };
  
  const handleViewChange = (newView: 'search' | 'categories' | 'favorites' | 'about') => {
    setView(newView);
    setSelectedCategory(null);
    setJournalHistory([]);
    setSelectedJournalList(null);
    setPreservedSearchTerm("");
    setMobileMenuOpen(false);
    setIsEditing(false);
    setSelectedJournals(new Set());
  }

  const handleExport = () => {
    const isExportingSelection = isEditing && selectedJournals.size > 0;
    const journalsForExport = isExportingSelection
      ? journalsToDisplay.filter(j => selectedJournals.has(getPrimaryIssn(j.issn)))
      : journalsToDisplay;

    if (journalsForExport.length === 0) return;

    let filename = "journal-list.csv";
    if (selectedJournalList) {
      filename = `${isExportingSelection ? 'Selected-' : ''}Favorites-${selectedJournalList.name.replace(/\s+/g, '_')}.csv`;
    } else if (selectedCategory) {
      filename = `${isExportingSelection ? 'Selected-' : ''}Category-${selectedCategory.replace(/\s+/g, '_')}.csv`;
    }

    const headers = hasPartition
      ? ["Journal Name", "ISSN/EISSN", "Impact Factor", exportPartitionHeader, "Authority Level", "Open Access"]
      : ["Journal Name", "ISSN/EISSN", "Impact Factor", "Open Access"];
    const data = journalsForExport.map(j => hasPartition
      ? [
          j.journalName,
          j.issn,
          j.impactFactor,
          j.majorCategoryPartition,
          j.authorityJournal,
          j.openAccess,
        ]
      : [
          j.journalName,
          j.issn,
          j.impactFactor,
          j.openAccess,
        ]);

    triggerCsvDownload([headers, ...data], filename);
  };
  
  // --- Batch Edit Handlers ---
  const toggleEditing = () => {
    setIsEditing(!isEditing);
    setSelectedJournals(new Set());
  };

  const handleSelectionChange = (journalId: string, selected: boolean) => {
    const newSelection = new Set(selectedJournals);
    if (selected) {
      newSelection.add(journalId);
    } else {
      newSelection.delete(journalId);
    }
    setSelectedJournals(newSelection);
  };

  const handleSelectAll = (checked: boolean | "indeterminate") => {
    if (checked) {
      const allJournalIds = new Set(journalsToDisplay.map(j => getPrimaryIssn(j.issn)));
      setSelectedJournals(allJournalIds);
    } else {
      setSelectedJournals(new Set());
    }
  };

  const handleDeleteSelected = () => {
    if (!user || !firestore || !selectedJournalList) return;

    setIsDeleteDialogOpen(false);
    setSelectedJournals(new Set());
    setIsEditing(false);

    // Show optimistic toast
    const successDescription = selectedJournals.size === 1
        ? t('batchEdit.remove.successDescription_one')
        : t('batchEdit.remove.successDescription_other', {count: selectedJournals.size});
    
    toast({
        title: t('batchEdit.remove.successTitle'),
        description: successDescription,
    });

    const performDelete = async () => {
        const listIdToRemove = selectedJournalList?.id;

        if (!listIdToRemove) {
            console.error("No list selected for deletion.");
            return;
        }

        try {
            const batch = writeBatch(firestore);
            const favoritesColRef = collection(firestore, `users/${user.uid}/favorite_journals`);
            const journalIds = Array.from(selectedJournals);
            
            // Chunking journalIds to stay within query limits
            for (let i = 0; i < journalIds.length; i += 30) {
                const chunk = journalIds.slice(i, i + 30);
                
                const q = query(favoritesColRef, where('listId', '==', listIdToRemove), where('journalId', 'in', chunk));

                const snapshot = await getDocs(q);
                snapshot.forEach(doc => {
                   batch.delete(doc.ref);
                });
            }

            await batch.commit();

        } catch(e) {
            console.error("Error deleting journals: ", e);
            toast({
                variant: "destructive",
                title: t('batchEdit.remove.errorTitle'),
                description: t('batchEdit.remove.errorDescription')
            });
        }
    };
    
    performDelete();
  }
  
  const isAllSelected = journalsToDisplay.length > 0 && selectedJournals.size === journalsToDisplay.length;

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
      <Pagination className="mt-8">
        {isMobile ? (
          <div className="w-full flex flex-col items-center gap-2">
              <p className="text-sm text-muted-foreground">
              {t('pagination.total')} {totalPages} {t('pagination.pages')}
            </p>
            <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                      href="#"
                      onClick={(e) => { e.preventDefault(); handlePageChange(currentPage - 1); }}
                      aria-disabled={currentPage === 1}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                  >
                      {t('pagination.previous')}
                  </PaginationPrevious>
                </PaginationItem>
                {getPaginationItems(currentPage, totalPages, handlePageChange, true)}
                <PaginationItem>
                  <PaginationNext
                      href="#"
                      onClick={(e) => { e.preventDefault(); handlePageChange(currentPage + 1); }}
                      aria-disabled={currentPage === totalPages}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                  >
                      {t('pagination.next')}
                  </PaginationNext>
                </PaginationItem>
            </PaginationContent>
          </div>
        ) : (
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handlePageChange(currentPage - 1);
                }}
                aria-disabled={currentPage === 1}
                className={
                  currentPage === 1
                    ? "pointer-events-none opacity-50"
                    : ""
                }
              >
                {t('pagination.previous')}
              </PaginationPrevious>
            </PaginationItem>

            {getPaginationItems(currentPage, totalPages, handlePageChange)}

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handlePageChange(currentPage + 1);
                }}
                aria-disabled={currentPage === totalPages}
                className={
                  currentPage === totalPages
                    ? "pointer-events-none opacity-50"
                    : ""
                }
              >
                {t('pagination.next')}
              </PaginationNext>
            </PaginationItem>
          </PaginationContent>
        )}
      </Pagination>
    );
  }

  const renderListHeader = () => {
    return (
        <div className="flex items-center gap-4 mb-6">
            <Button variant="outline" size="icon" onClick={handleBackToList}>
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 flex-grow">
                <Folder className="h-6 w-6 text-primary" />
                <h2 className="font-headline text-2xl md:text-3xl font-bold tracking-tight">
                {selectedJournalList?.name || (selectedCategory ? getMajorCategoryName(selectedCategory, locale) : '')}
                </h2>
            </div>
        </div>
    )
  };

  const renderActionToolbar = () => {
    const isFavoritesView = !!selectedJournalList;
    const canEdit = user;
    
    if (journalsToDisplay.length === 0) return null;

    return (
      <div className="flex flex-wrap items-center justify-end gap-4 mb-6">
          {isEditing && (
              <div className="flex items-center gap-2 mr-auto">
                  <Checkbox
                      id="select-all"
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                  />
                  <label htmlFor="select-all" className="text-sm font-medium">
                      {isAllSelected ? t('batchEdit.deselectAll') : t('batchEdit.selectAll')}
                  </label>
              </div>
          )}
          {canEdit && (
              <Button variant="outline" onClick={toggleEditing}>
                  {isEditing ? <X className="mr-2 h-4 w-4" /> : <Pencil className="mr-2 h-4 w-4" />}
                  {isEditing ? t('common.cancel') : (isFavoritesView ? t('batchEdit.button') : t('batchEdit.favorite.editButton'))}
              </Button>
          )}
          <Button variant="outline" onClick={handleExport} disabled={journalsToDisplay.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              {t('common.exportCsv')}
          </Button>
      </div>
    )
  };

  const renderContent = () => {
    switch (view) {
      case "search":
        return <SearchPage journals={journals} onJournalSelect={handleJournalSelect} initialSearchTerm={preservedSearchTerm} />;
      case "favorites":
      case "categories":
        if (selectedJournalList || selectedCategory) {
          return (
            <div className="animate-in fade-in-50 duration-300">
              {renderListHeader()}
              {hasPartition && (
              <div className="mb-6">
                <CategoryStats journals={journalsToDisplay} collapsible defaultOpen={true} />
              </div>
              )}
              {renderActionToolbar()}
              {paginatedJournals.length > 0 ? (
                <div className="space-y-2">
                  {paginatedJournals.map((journal) => {
                    const journalId = getPrimaryIssn(journal.issn);
                    return (
                        <JournalListItem
                          key={journal.issn}
                          journal={journal}
                          onClick={() => handleJournalSelect(journal)}
                          isEditing={isEditing}
                          isSelected={selectedJournals.has(journalId)}
                          onSelectionChange={(selected) => handleSelectionChange(journalId, selected)}
                        />
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10">
                  <p className="text-muted-foreground">{t('favorites.listEmpty')}</p>
                </div>
              )}
              {renderPagination()}
            </div>
          );
        }
        // Fallback to specific view content if no list/category is selected
        if (view === 'favorites') {
          return <FavoritesContent 
                  allFavorites={allFavoriteEntries} 
                  journalLists={journalLists}
                  isLoadingLists={isLoadingLists}
                  onJournalListSelect={handleJournalListSelect} 
                  onFindJournalsClick={() => handleViewChange('search')}
                  onLoginClick={() => setIsLoginDialogOpen(true)}
                  journals={journals}
                />;
        } else { // categories
          return (
            <div className="animate-in fade-in-50 duration-300 space-y-8">
              {hasPartition ? (
                <>
                  <CategoryStats journals={journals} collapsible defaultOpen={true} />
                  <CategoryBrowse
                    categories={sortedCategories}
                    onCategorySelect={handleCategorySelect}
                  />
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-8 text-center">
                  <p className="text-muted-foreground">{t("edition.jcrOnlyBrowseUnavailable")}</p>
                </div>
              )}
            </div>
          );
        }
      case "about":
        return <AboutPage />;
      default:
        return null;
    }
  };

  const navViewItems: { id: 'search' | 'categories' | 'favorites' | 'about'; labelKey: string; icon: React.ElementType }[] = [
    { id: 'search', labelKey: 'nav.search', icon: SearchIcon },
    ...(hasPartition ? [{ id: 'categories' as const, labelKey: 'nav.browse', icon: BookOpen }] : []),
    { id: 'favorites', labelKey: 'nav.favorites', icon: Star },
    { id: 'about', labelKey: 'nav.about', icon: Info },
  ];

  const navItems = (
    <>
      {navViewItems.map(({ id, labelKey, icon: Icon }) => (
        <Button
          key={id}
          onClick={() => handleViewChange(id)}
          variant={view === id ? "secondary" : "ghost"}
          className={cn(
            "w-full justify-start text-base py-3 px-1.5",
            view === id && "bg-background shadow-sm ring-1 ring-border/50"
          )}
        >
          <Icon className="mr-3 h-5 w-5" />
          {t(labelKey)}
        </Button>
      ))}
    </>
  );

  const desktopNavItems = (
    <nav className="hidden sm:flex items-center p-1 bg-muted/80 rounded-lg ring-1 ring-border/40">
      {navViewItems.map(({ id, labelKey }) => (
        <button
          key={id}
          type="button"
          onClick={() => handleViewChange(id)}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200",
            view === id
              ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t(labelKey)}
        </button>
      ))}
    </nav>
  );

  const BatchActionBottomBar = () => {
    if (!isEditing || !user || selectedJournals.size === 0) return null;
    
    const isFavoritesView = !!selectedJournalList;
    const isBrowseView = view === 'categories' && selectedCategory;
    const journalsToProcess = journalsToDisplay.filter(j => selectedJournals.has(getPrimaryIssn(j.issn)));
    
    const getDeleteDialogTitle = () => {
        if (selectedJournals.size === 1) {
            return t('batchEdit.remove.confirmTitle_one');
        }
        return t('batchEdit.remove.confirmTitle_other', {count: selectedJournals.size});
    };

    const handleBatchSuccess = () => {
      setSelectedJournals(new Set());
      setIsEditing(false);
    };

    const getBatchAddDialog = () => (
      <AddToFavoritesDialog
        open={isAddToFavoritesOpen}
        onOpenChange={setIsAddToFavoritesOpen}
        journal={journalsToProcess[0]}
        mode='add'
        batchJournals={journalsToProcess}
        onSuccess={handleBatchSuccess}
      />
    );
    
    const getBatchMoveDialog = () => (
      <AddToFavoritesDialog
        open={isMoveDialogOpen}
        onOpenChange={setIsMoveDialogOpen}
        journal={journalsToProcess[0]}
        mode='move'
        batchJournals={journalsToProcess}
        currentListId={selectedJournalList?.id}
        onSuccess={handleBatchSuccess}
      />
    );

    const getBatchDeleteDialog = () => {
        const title = selectedJournals.size === 1 ? t('batchEdit.remove.confirmTitle_one') : t('batchEdit.remove.confirmTitle_other', {count: selectedJournals.size});
        return (
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{title}</AlertDialogTitle>
                        <AlertDialogDescription>
                        {t('batchEdit.remove.confirmDescription', { listName: selectedJournalList?.name ?? '' })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteSelected} className="bg-destructive hover:bg-destructive/90">
                        {t('batchEdit.remove.button')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        );
    }


    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom-12 duration-300">
        <div className="max-w-xl mx-auto">
          <Card className="shadow-2xl ring-1 ring-border/50 backdrop-blur-sm bg-card/95">
            <CardContent className="p-3 flex items-center justify-between">
              <span className="text-sm font-medium">
                {t('batchEdit.selected', { count: selectedJournals.size })}
              </span>
              <div className="flex items-center gap-2">
                {isFavoritesView && (
                    <Button variant="outline" size="sm" onClick={() => setIsMoveDialogOpen(true)}>
                        <FolderSync className="mr-2 h-4 w-4" />
                        {t('batchEdit.move.button')}
                    </Button>
                )}
                {isBrowseView && (
                    <Button variant="outline" size="sm" onClick={() => setIsAddToFavoritesOpen(true)}>
                        <Heart className="mr-2 h-4 w-4" />
                        {t('batchEdit.add.button')}
                    </Button>
                )}
                {isFavoritesView && (
                    <Button variant="destructive" size="sm" onClick={() => setIsDeleteDialogOpen(true)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('batchEdit.remove.button')}
                    </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {isMoveDialogOpen && isFavoritesView && getBatchMoveDialog()}
        {isAddToFavoritesOpen && isBrowseView && getBatchAddDialog()}
        {isDeleteDialogOpen && isFavoritesView && getBatchDeleteDialog()}
      </div>
    );
  };


  return (
    <>
      <div className="page-shell flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 shadow-sm">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="sm:hidden">
                  <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                      <SheetTrigger asChild>
                          <Button variant="outline" size="icon">
                              <Menu className="h-5 w-5" />
                              <span className="sr-only">Open menu</span>
                          </Button>
                      </SheetTrigger>
                      <SheetContent side="left" className="pt-8 w-[58vw] max-w-[250px] px-2 py-3 gap-3">
                        <div>
                          <SheetHeader>
                            <SheetTitle className="sr-only">Menu</SheetTitle>
                            <SheetDescription className="sr-only">
                              Main navigation menu
                            </SheetDescription>
                          </SheetHeader>
                          <a href="/">
                            <AjiLogo />
                          </a>
                        </div>
                        <div className="mt-6">
                          <EditionSwitcher className="w-full" />
                        </div>
                        <div className="mt-6 flex flex-col gap-1">
                          {navItems}
                        </div>
                      </SheetContent>
                  </Sheet>
              </div>
              <a href="/" className="hidden sm:flex items-center">
                <AjiLogo />
              </a>
              {desktopNavItems}
            </div>
            
            <div className="flex items-center justify-end gap-2">
              <EditionSwitcher className="hidden sm:flex" />
              <LanguageToggle />
              <ThemeToggle />
              <UserAvatar onLoginClick={() => setIsLoginDialogOpen(true)} />
            </div>
          </div>
        </header>
        <div className="flex-grow pb-24">
          <div className="py-8 md:py-10">
              {selectedJournal ? (
                <JournalDetail
                  key={selectedJournal.issn}
                  journal={selectedJournal}
                  onBack={handleBackFromDetail}
                  onJournalSelect={handleJournalSelectByName}
                  isHistoryRoot={journalHistory.length <= 1}
                />
              ) : (
                renderContent()
              )}
          </div>
        </div>
        <footer className="border-t py-4 text-center text-sm text-muted-foreground">
          © 2025-2026 Jing Wang. All Rights Reserved.
        </footer>
      </div>
      {!selectedJournal && <BatchActionBottomBar />}
      <LoginDialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen} />
    </>
  );
}
