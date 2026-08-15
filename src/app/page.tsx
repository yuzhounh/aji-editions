import CategoryPage from '@/components/search/CategoryPage';
import { EditionProvider } from '@/contexts/EditionContext';

export default function Home() {
  return (
    <EditionProvider>
      <CategoryPage />
    </EditionProvider>
  );
}
