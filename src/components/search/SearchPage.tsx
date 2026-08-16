

"use client";

import * as React from "react";
import { useState, useMemo, ChangeEvent, useEffect, useRef } from "react";
import type { Journal } from "@/data/journals";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, Download, Pencil, X, Heart } from "lucide-react";
import CategoryStats from "./CategoryStats";
import { useTranslation } from "@/i18n/provider";
import { usePartitionTerminology } from "@/hooks/use-partition-terminology";
import JournalListItem from "./JournalListItem";
import { useIsMobile } from "@/hooks/use-is-mobile";
import Papa from "papaparse";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import AddToFavoritesDialog from "../favorites/AddToFavoritesDialog";
import { Card, CardContent } from "../ui/card";
import { useFirebase } from "@/firebase";
import { cn } from "@/lib/utils";
import { getPrimaryIssn } from "@/lib/issn";

const SEARCH_EXAMPLES = ["Nature", "Cell", "Lancet", "IEEE"];

interface SearchPageProps {
  journals: Journal[];
  onJournalSelect: (journal: Journal, searchTerm: string) => void;
  initialSearchTerm?: string;
}

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


function SearchClient({ journals, onJournalSelect, initialSearchTerm = "" }: SearchPageProps) {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [currentPage, setCurrentPage] = useState(1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { user } = useFirebase();
  const { t } = useTranslation();
  const { exportPartitionHeader, hasPartition } = usePartitionTerminology();
  const isMobile = useIsMobile();

  // Batch edit state
  const [isEditing, setIsEditing] = useState(false);
  const [selectedJournals, setSelectedJournals] = useState<Set<string>>(new Set());
  const [isAddToFavoritesOpen, setIsAddToFavoritesOpen] = useState(false);


  useEffect(() => {
    setSearchTerm(initialSearchTerm);
    if (initialSearchTerm) {
        setCurrentPage(1);
        setIsEditing(false);
        setSelectedJournals(new Set());
    }
  }, [initialSearchTerm]);

  const filteredJournals = useMemo(() => {
    if (searchTerm.length < 3) {
      return [];
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    return journals
      .filter((journal) =>
        journal.journalName.toLowerCase().includes(lowercasedTerm)
      )
      .sort((a, b) => {
        const factorA = typeof a.impactFactor === 'number' ? a.impactFactor : 0;
        const factorB = typeof b.impactFactor === 'number' ? b.impactFactor : 0;
        return factorB - factorA;
      });
  }, [searchTerm, journals]);

  const totalPages = Math.ceil(filteredJournals.length / JOURNALS_PER_PAGE);

  const paginatedJournals = useMemo(() => {
    const startIndex = (currentPage - 1) * JOURNALS_PER_PAGE;
    return filteredJournals.slice(startIndex, startIndex + JOURNALS_PER_PAGE);
  }, [filteredJournals, currentPage]);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
    setIsEditing(false);
    setSelectedJournals(new Set());
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setCurrentPage(1);
    setIsEditing(false);
    setSelectedJournals(new Set());
    searchInputRef.current?.focus();
  };
  
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo(0, 0);
    }
  };

  const handleExport = () => {
    const isExportingSelection = isEditing && selectedJournals.size > 0;
    const journalsForExport = isExportingSelection
      ? filteredJournals.filter(j => selectedJournals.has(getPrimaryIssn(j.issn)))
      : filteredJournals;

    if (journalsForExport.length === 0) return;
    
    const filename = `${isExportingSelection ? 'Selected-' : ''}Search-results-for-${searchTerm.replace(/\s+/g, '_')}.csv`;
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
      const allJournalIds = new Set(filteredJournals.map(j => getPrimaryIssn(j.issn)));
      setSelectedJournals(allJournalIds);
    } else {
      setSelectedJournals(new Set());
    }
  };
  
  const isAllSelected = filteredJournals.length > 0 && selectedJournals.size === filteredJournals.length;

  const showInitialMessage = searchTerm.length < 3;
  const showNoResultsMessage = searchTerm.length >= 3 && filteredJournals.length === 0;
  const hasResults = filteredJournals.length > 0;

  const handleExampleClick = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
    setIsEditing(false);
    setSelectedJournals(new Set());
  };

  const renderActionToolbar = () => {
    if (filteredJournals.length === 0) return null;
    return (
        <div className="flex flex-wrap items-center justify-end gap-4 mb-6">
            {isEditing && (
              <div className="flex items-center gap-2 mr-auto">
                  <Checkbox
                      id="select-all-search"
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                  />
                  <label htmlFor="select-all-search" className="text-sm font-medium">
                      {isAllSelected ? t('batchEdit.deselectAll') : t('batchEdit.selectAll')}
                  </label>
              </div>
            )}
            {user && (
              <Button variant="outline" onClick={toggleEditing}>
                  {isEditing ? <X className="mr-2 h-4 w-4" /> : <Pencil className="mr-2 h-4 w-4" />}
                  {isEditing ? t('common.cancel') : t('batchEdit.favorite.editButton')}
              </Button>
            )}
             <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                {t('common.exportCsv')}
            </Button>
        </div>
    )
  }

  const BatchActionBottomBar = () => {
    if (!isEditing || !user || selectedJournals.size === 0) return null;

    const journalsToFavorite = filteredJournals.filter(j => selectedJournals.has(getPrimaryIssn(j.issn)));

    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom-12 duration-300">
        <div className="max-w-xl mx-auto">
          <Card className="shadow-2xl ring-1 ring-border/50 backdrop-blur-sm bg-card/95">
            <CardContent className="p-3 flex items-center justify-between">
              <span className="text-sm font-medium">
                {t('batchEdit.selected', { count: selectedJournals.size })}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsAddToFavoritesOpen(true)}>
                  <Heart className="mr-2 h-4 w-4" />
                  {t('batchEdit.add.button')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        {isAddToFavoritesOpen && (
          <AddToFavoritesDialog
            open={isAddToFavoritesOpen}
            onOpenChange={setIsAddToFavoritesOpen}
            journal={journalsToFavorite[0]} // Pass a representative journal
            mode='add'
            batchJournals={journalsToFavorite}
            onSuccess={() => {
                setSelectedJournals(new Set());
                setIsEditing(false);
            }}
          />
        )}
      </div>
    );
  };


  return (
    <div className="w-full space-y-6">
      <div className={cn("text-center transition-all duration-300", hasResults ? "mb-2" : "mb-4")}>
        <h1 className={cn(
          "font-headline font-bold tracking-tight transition-all duration-300",
          hasResults ? "text-2xl md:text-3xl" : "text-4xl md:text-5xl"
        )}>
          {t('header.title')}
        </h1>
        {!hasResults && (
          <p className="mt-2 text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('header.subtitle')}
          </p>
        )}
      </div>

      <div className="relative w-full">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
        <Input
          ref={searchInputRef}
          type="text"
          placeholder={t('search.placeholder')}
          value={searchTerm}
          onChange={handleSearchChange}
          className={cn(
            "w-full pl-12 h-14 text-lg rounded-2xl shadow-card ring-1 ring-border/50 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:shadow-card-hover transition-all duration-200",
            searchTerm.length > 0 && "pr-14"
          )}
          aria-label={t('search.ariaLabel')}
        />
        {searchTerm.length > 0 && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="group absolute right-3 top-1/2 flex -translate-y-1/2 items-center rounded-full px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2"
            aria-label={t('search.clearAriaLabel')}
          >
            <X className="h-6 w-6 shrink-0" strokeWidth={2} />
            <span className="hidden max-w-0 overflow-hidden whitespace-nowrap text-base font-medium opacity-0 transition-all duration-200 group-hover:inline group-hover:max-w-[5rem] group-hover:ml-1 group-hover:opacity-100">
              {t('search.clear')}
            </span>
          </button>
        )}
      </div>

      {showInitialMessage && (
        <div className="flex flex-col gap-4 w-full">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('search.examplesLabel')}:</span>
            {SEARCH_EXAMPLES.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => handleExampleClick(term)}
                className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-sm font-medium text-foreground transition-colors hover:bg-primary/10 hover:border-primary/30 hover:text-primary"
              >
                {term}
              </button>
            ))}
          </div>
          <div className="w-full text-center py-10 px-4 rounded-xl bg-muted/30 ring-1 ring-border/40">
              <Search className="mx-auto h-10 w-10 text-muted-foreground/70" />
              <h3 className="mt-3 text-base font-medium text-foreground">{t('search.initial.title')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                  {t('search.initial.description')}
              </p>
          </div>
        </div>
      )}

      {filteredJournals.length > 0 && (
        <div className="animate-in fade-in-50 duration-300 space-y-6">
          {hasPartition && (
            <CategoryStats journals={filteredJournals} collapsible defaultOpen={true} />
          )}
          {renderActionToolbar()}
        </div>
      )}
      {showNoResultsMessage && (
          <div className="text-center py-10">
              <p className="text-muted-foreground">{t('search.noResults', { searchTerm })}</p>
          </div>
      )}

      {paginatedJournals.length > 0 && (
        <div className="space-y-2 animate-in fade-in-50 duration-300">
          {paginatedJournals.map((journal) => {
            const journalId = getPrimaryIssn(journal.issn);
            return (
              <JournalListItem
                key={journal.issn}
                journal={journal}
                onClick={() => onJournalSelect(journal, searchTerm)}
                isEditing={isEditing}
                isSelected={selectedJournals.has(journalId)}
                onSelectionChange={(selected) => handleSelectionChange(journalId, selected)}
              />
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
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
      )}
      <BatchActionBottomBar />
    </div>
  );
}

export default function SearchPage({ journals, onJournalSelect, initialSearchTerm = "" }: SearchPageProps) {
  return <SearchClient journals={journals} onJournalSelect={onJournalSelect} initialSearchTerm={initialSearchTerm} />;
}
