import packageMetadata from "../../package.json" with { type: "json" };

export const PRODUCT_NAME = "MECHA//TODO";
export const PRODUCT_SLUG = "mecha-todo";
export const APPLICATION_VERSION = packageMetadata.version;

export const DATABASE_NAME = PRODUCT_SLUG;
export const COMPOSER_DRAFT_STORAGE_KEY = `${PRODUCT_SLUG}:composer-draft:v1`;
