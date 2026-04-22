export type ArticleDTO = {
  id: string;
  setId: string;
  title: string;
  wikipediaUrl: string;
  wikipediaPageId: number;
  categories: string[];
  disabledCategories: string[];
  customHints: string[];
  aliases: string[];
  customAliases: string[];
  summary: string | null;
  thumbnailUrl: string | null;
  pageViews: number | null;
  difficultyScore: number | null;
  orderIndex: number;
  createdAt: string;
};

export type SetSummary = {
  id: string;
  name: string;
  description: string | null;
  hidden: boolean;
  articleCount: number;
  createdAt: string;
  updatedAt: string;
  lastPlayedAt: string | null;
  isMine: boolean;
  canManage: boolean;
  creatorName: string | null;
  difficultyScore: number | null;
};

export type SetDetail = {
  id: string;
  name: string;
  description: string | null;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
  isMine: boolean;
  canManage: boolean;
  creatorName: string | null;
  difficultyScore: number | null;
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

export type ProfileDTO = {
  id: string | null;
  displayName: string | null;
  hasPassword: boolean;
};
