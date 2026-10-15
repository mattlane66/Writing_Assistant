FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg python3 python3-pil fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN python3 scripts/generate-review-video.py && npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/server ./server
COPY --from=build /app/knowledge ./knowledge
COPY --from=build /app/products/writing-diagnostic/package.json ./products/writing-diagnostic/package.json
COPY --from=build /app/products/writing-diagnostic/server ./products/writing-diagnostic/server
COPY --from=build /app/products/writing-diagnostic/public ./products/writing-diagnostic/public
COPY --from=build /app/products/writing-assistant-plugin/ui ./products/writing-assistant-plugin/ui
COPY --from=build /app/dist ./dist

# Fail the image build if the shared Diagnostic runtime is missing.
RUN node -e "import('./server/writing-diagnostic.mjs')"

# Validate the checkpoint resource and all workflow fingerprint inputs inside
# the actual runtime image, not only the complete development checkout.
RUN node --input-type=module -e "const { readWritingCheckpointResource, WRITING_CHECKPOINT_UI_URI } = await import('./server/writing-checkpoint.mjs'); await readWritingCheckpointResource(WRITING_CHECKPOINT_UI_URI); const { workflowKnowledgeFingerprint } = await import('./server/writing-workflow.mjs'); await workflowKnowledgeFingerprint();"

# Validate the public book-informed corpus in the actual runtime image.
# This reads allowlisted public cards/ledger only and makes no model requests.
RUN node --input-type=module -e "const { getWritingCoverage } = await import('./server/book-informed.mjs'); await getWritingCoverage({});"

EXPOSE 8787
CMD ["node", "server/index.mjs"]
