export type SourceRef = {
  documentId: string;
  title: string;
  chunkId: string;
  page: number | null;
  excerpt: string;
};

export type ContentResult = {
  title: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  visualPrompt: string;
  notesToVerify: string[];
  language: string;
  format: string;
  variantLabel: string;
};

export type TaskInput = {
  contentType: string;
  platform: string;
  goal: string;
  language: string;
  topic: string;
  tone: string;
  audience: string;
  constraints: string[];
  useKnowledgeBase: boolean;
};

export type BrandInput = {
  name: string;
  niche: string;
  products: string[];
  audience: string;
  tone: string;
  language: string;
  valueProposition: string;
  ctaDefaults: string[];
  forbiddenTerms: string[];
};

export type QuotaSnapshot = {
  text: { used: number; limit: number };
  image: { used: number; limit: number };
  upload: { used: number; limit: number };
};

export type Me = {
  user: { id: string; email: string; locale: string; isAdmin: boolean };
  workspace: { id: string; name: string };
  brand: BrandInput;
  quota: QuotaSnapshot;
};
