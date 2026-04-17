export type ArticleDTO = {
  id: string;
  setId: string;
  title: string;
  wikipediaUrl: string;
  wikipediaPageId: number;
  categories: string[];
  customHints: string[];
  aliases: string[];
  customAliases: string[];
  summary: string | null;
  thumbnailUrl: string | null;
  orderIndex: number;
  createdAt: string;
};

export type SetSummary = {
  id: string;
  name: string;
  description: string | null;
  articleCount: number;
  createdAt: string;
  updatedAt: string;
  lastPlayedAt: string | null;
  isMine: boolean;
  canManage: boolean;
};

export type SetDetail = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  isMine: boolean;
  canManage: boolean;
  articles: ArticleDTO[];
};

export type PlayResultEntry = {
  articleId: string;
  guesserName: string;
  guessText: string;
  correct: boolean;
  skipped: boolean;
  verdict?: "EXACT" | "CLOSE" | "WRONG" | "SKIP";
  points?: number;
  articleTitle?: string;
};

export type FetchedArticlePreview = {
  title: string;
  url: string;
  pageId: number;
  categories: string[];
  rawCategoryCount: number;
  aliases: string[];
  summary: string | null;
  thumbnailUrl: string | null;
};
