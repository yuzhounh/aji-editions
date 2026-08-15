import CategoryPage from '@/components/search/CategoryPage';
import { EditionProvider } from '@/contexts/EditionContext';
import { editionsCollection } from '@/data/journals';

export default function Home() {
  return (
    <EditionProvider collection={editionsCollection}>
      <CategoryPage />
    </EditionProvider>
  );
}
