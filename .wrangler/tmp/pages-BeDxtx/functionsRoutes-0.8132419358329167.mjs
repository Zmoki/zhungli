import { onRequestPost as __ingest_batch_js_onRequestPost } from "/Users/zarema/Projects/Zmoki/zhungli/.claude/worktrees/hide-repo-files/functions/ingest/batch.js"

export const routes = [
    {
      routePath: "/ingest/batch",
      mountPath: "/ingest",
      method: "POST",
      middlewares: [],
      modules: [__ingest_batch_js_onRequestPost],
    },
  ]