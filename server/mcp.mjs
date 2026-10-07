import {
  getWritingMethods,
  getWritingReference,
  listReferenceIds,
  searchWritingMethods,
} from "./editorial-retrieval.mjs";
import {
  BOOK_TOOL_SCHEMAS, searchWritingExamples, getWritingExamples,
  getWritingCoverage, checkWritingRevision,
} from "./book-informed.mjs";
import {
  buildWritingAssistantDiagnostic,
  getWritingDiagnosticResourceList,
  readWritingDiagnosticResource,
  WRITING_DIAGNOSTIC_INPUT_SCHEMA,
  WRITING_DIAGNOSTIC_OUTPUT_SCHEMA,
  WRITING_DIAGNOSTIC_UI_URI,
} from "./writing-diagnostic.mjs";

export const MCP_SUPPORTED_VERSIONS = Object.freeze([
  "2026-07-28",
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
]);

export const MCP_SERVER_INFO = Object.freeze({
  name: "writing-assistant",
  version: "2.2.0",
});

export const MCP_INSTRUCTIONS =
  "Writing Assistant is a repository-guided editorial server. Retrieve methods and original examples with an abstract task description; preserve exceptions. The host model does all writing and semantic judgment. Coverage is partial, not full-book mastery. Exact passages go to check_writing_revision only with user authorization; its literal signals are not verdicts. Use render_writing_diagnostic only after host analysis. No model calls occur here. Do not send private drafts to retrieval tools.";

const NOAUTH = Object.freeze([{ type: "noauth" }]);
const READ_ONLY_ANNOTATIONS = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  idempotentHint: true,
});

const STRING_ARRAY = Object.freeze({
  type: "array",
  items: { type: "string" },
});

const METHOD_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "name",
    "category",
    "description",
    "procedure",
    "triggers",
    "anti_triggers",
    "exceptions",
    "eval_criteria",
  ],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    category: { type: "string" },
    description: { type: "string" },
    procedure: STRING_ARRAY,
    triggers: STRING_ARRAY,
    anti_triggers: STRING_ARRAY,
    exceptions: STRING_ARRAY,
    eval_criteria: {
      type: "object",
      additionalProperties: false,
      required: ["recognition", "execution"],
      properties: {
        recognition: STRING_ARRAY,
        execution: STRING_ARRAY,
      },
    },
    match_score: { type: "number" },
    matched_terms: STRING_ARRAY,
  },
});

const SEARCH_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["registry_version", "source_revision", "query", "methods"],
  properties: {
    registry_version: { type: "string" },
    source_revision: { type: "string" },
    query: { type: "string" },
    methods: { type: "array", items: METHOD_SCHEMA },
  },
});

const METHODS_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["registry_version", "source_revision", "methods"],
  properties: {
    registry_version: { type: "string" },
    source_revision: { type: "string" },
    methods: { type: "array", items: METHOD_SCHEMA },
  },
});

const REFERENCE_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["reference_id", "title", "source_path", "source_revision", "content"],
  properties: {
    reference_id: { type: "string" },
    title: { type: "string" },
    source_path: { type: "string" },
    source_revision: { type: "string" },
    content: { type: "string" },
  },
});

function objectSchema(properties, required) {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required,
  };
}

function bookTools() {
  const definitions = [
    ["search_writing_examples", "Search book-informed practice examples", "Retrieve original practice examples, alternatives, exceptions, counterexamples and source-page provenance for a short abstract editorial problem. Do not send a private draft to select methods. Scores are candidate signals, not applicability judgments. Returned examples are original illustrations, not book quotations or evidence about the user's topic."],
    ["get_writing_examples", "Get writing examples by id", "Load complete original example cards by known stable card IDs, including exceptions, multiple defensible revisions where recorded, non-application examples and source caveats. Use to revisit cards already selected; not arbitrary file or PDF access."],
    ["get_writing_coverage", "Inspect book knowledge coverage", "Report the actual source identities, tracked model-reviewed pages, unreviewed gaps, and method/example coverage. Use when asked what book knowledge is available or whether coverage is complete. Counts do not certify idea recall, human validation or effective execution."],
    ["check_writing_revision", "Check a revision with bounded literal tests", "With the user's authorization to transmit both exact passages to this service, inspect a host-written candidate for supported formal calculation mismatches and literal fidelity/state signals. Set text_processing_authorized only after that authorization. Results are review candidates, never semantic certification or external factual verification. Does not write or call a model. In draft/analysis modes, do not require the output to restate the original."],
  ];
  return definitions.map(([name, title, description]) => ({ name, title, description,
    inputSchema: BOOK_TOOL_SCHEMAS[name].input, outputSchema: BOOK_TOOL_SCHEMAS[name].output,
    annotations: { ...READ_ONLY_ANNOTATIONS }, securitySchemes: NOAUTH,
    _meta: { securitySchemes: NOAUTH, "openai/toolInvocation/invoking": `${title}…`, "openai/toolInvocation/invoked": `${title}: complete.` },
  }));
}

export function getWritingAssistantTools() {
  return [
    {
      name: "search_writing_methods",
      title: "Search writing methods",
      description:
        "Search the public Writing Assistant repository's canonical method registry and return the most relevant full method records. Use a short abstract description of the editorial problem, not the user's full private draft. The host ChatGPT or Codex model must apply the returned methods itself.",
      inputSchema: objectSchema(
        {
          query: {
            type: "string",
            minLength: 1,
            maxLength: 1200,
            description:
              "A short, non-sensitive description of the writing problem, goal, genre, and relevant risks. Do not paste the full draft when an abstract description is enough.",
          },
          category: {
            type: "string",
            enum: [
              "editorial-contract",
              "craft",
              "syntax",
              "source-discipline",
              "coherence",
              "argument-reasoning",
            ],
            description: "Optional method category filter.",
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 8,
            default: 5,
            description: "Maximum number of full method records to return.",
          },
        },
        ["query"],
      ),
      outputSchema: SEARCH_OUTPUT_SCHEMA,
      annotations: { ...READ_ONLY_ANNOTATIONS },
      securitySchemes: NOAUTH,
      _meta: {
        securitySchemes: NOAUTH,
        "openai/toolInvocation/invoking": "Finding the relevant writing methods…",
        "openai/toolInvocation/invoked": "Writing methods retrieved.",
      },
    },
    {
      name: "get_writing_methods",
      title: "Get writing methods",
      description:
        "Fetch full canonical Writing Assistant method records by id from the deployed repository. Use when the skill already knows which methods it needs or when a prior search returned ids worth retaining.",
      inputSchema: objectSchema(
        {
          ids: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            uniqueItems: true,
            items: { type: "string", minLength: 1 },
            description: "One to eight canonical method ids.",
          },
        },
        ["ids"],
      ),
      outputSchema: METHODS_OUTPUT_SCHEMA,
      annotations: { ...READ_ONLY_ANNOTATIONS },
      securitySchemes: NOAUTH,
      _meta: {
        securitySchemes: NOAUTH,
        "openai/toolInvocation/invoking": "Loading canonical writing methods…",
        "openai/toolInvocation/invoked": "Canonical methods loaded.",
      },
    },
    {
      name: "get_writing_reference",
      title: "Get writing reference",
      description:
        "Fetch one canonical Writing Assistant reference document from the deployed repository when method records are not enough. Use for deep semantic composition, coherence, editorial, or argument guidance. This tool returns repository text only; the host model performs the writing.",
      inputSchema: objectSchema(
        {
          reference: {
            type: "string",
            enum: listReferenceIds(),
            description: "Canonical reference document to retrieve.",
          },
        },
        ["reference"],
      ),
      outputSchema: REFERENCE_OUTPUT_SCHEMA,
      annotations: { ...READ_ONLY_ANNOTATIONS },
      securitySchemes: NOAUTH,
      _meta: {
        securitySchemes: NOAUTH,
        "openai/toolInvocation/invoking": "Loading the canonical writing reference…",
        "openai/toolInvocation/invoked": "Writing reference loaded.",
      },
    },
    {
      name: "render_writing_diagnostic",
      title: "Render writing diagnostic",
      description:
        "Render an already-reasoned Writing Assistant diagnostic. First retrieve the relevant canonical methods, then analyze the passage in the host model. Supply exact quotes, calibrated violation/pressure/pass judgments, the canonical method ids actually used for each finding, and the narrowest editing mode authorized by the user. This tool validates and presents the findings; it does not judge or rewrite the prose itself. Unlike the retrieval tools, this render step receives the exact passage because it must display the user's text.",
      inputSchema: WRITING_DIAGNOSTIC_INPUT_SCHEMA,
      outputSchema: WRITING_DIAGNOSTIC_OUTPUT_SCHEMA,
      annotations: { ...READ_ONLY_ANNOTATIONS },
      securitySchemes: NOAUTH,
      _meta: {
        securitySchemes: NOAUTH,
        ui: { resourceUri: WRITING_DIAGNOSTIC_UI_URI },
        "openai/outputTemplate": WRITING_DIAGNOSTIC_UI_URI,
        "openai/toolInvocation/invoking": "Preparing the writing diagnostic…",
        "openai/toolInvocation/invoked": "Writing diagnostic ready.",
      },
    },
    ...bookTools(),
  ];
}

function publicErrorMessage(error) {
  if (Number.isInteger(error?.status) && error.status === 400 && typeof error?.message === "string") {
    return error.message;
  }
  return "Writing Assistant could not retrieve repository guidance. Please try again.";
}

export async function callWritingAssistantTool(name, args) {
  try {
    let payload;
    switch (name) {
      case "search_writing_methods":
        payload = await searchWritingMethods(args ?? {});
        break;
      case "get_writing_methods":
        payload = await getWritingMethods(args ?? {});
        break;
      case "get_writing_reference":
        payload = await getWritingReference(args ?? {});
        break;
      case "render_writing_diagnostic":
        payload = await buildWritingAssistantDiagnostic(args ?? {});
        break;
      case "search_writing_examples":
        payload = await searchWritingExamples(args ?? {});
        break;
      case "get_writing_examples":
        payload = await getWritingExamples(args ?? {});
        break;
      case "get_writing_coverage":
        payload = await getWritingCoverage(args ?? {});
        break;
      case "check_writing_revision":
        payload = checkWritingRevision(args ?? {});
        break;
      default:
        return {
          isError: true,
          content: [{ type: "text", text: `Unknown Writing Assistant tool: ${name}` }],
        };
    }

    return {
      structuredContent: payload,
      content: [
        {
          type: "text",
          text:
            name === "get_writing_reference"
              ? payload.content
              : name === "render_writing_diagnostic"
                ? `Prepared ${payload.summary.total} diagnostic finding(s): ${payload.summary.violation} violations, ${payload.summary.pressure} pressure tests, and ${payload.summary.pass} passes. The interactive view lets the user inspect canonical method links and choose repair directions; the host model must perform any requested revision within the preserved ${payload.integration.editing_mode} mode.`
                : JSON.stringify(payload, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: publicErrorMessage(error) }],
    };
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function errorResponse(id, code, message, data) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data }),
    },
  };
}

function modernResult(result, cacheable = false) {
  return {
    ...result,
    resultType: "complete",
    _meta: {
      ...(result?._meta || {}),
      "io.modelcontextprotocol/serverInfo": MCP_SERVER_INFO,
    },
    ...(cacheable ? { ttlMs: 3_600_000, cacheScope: "public" } : {}),
  };
}

export function discoverWritingAssistantMcp() {
  return modernResult(
    {
      supportedVersions: [...MCP_SUPPORTED_VERSIONS],
      capabilities: { tools: {}, resources: {} },
      instructions: MCP_INSTRUCTIONS,
    },
    true,
  );
}

export async function handleWritingAssistantMcp(message, { protocolVersion } = {}) {
  if (
    !message ||
    typeof message !== "object" ||
    Array.isArray(message) ||
    message.jsonrpc !== "2.0" ||
    typeof message.method !== "string"
  ) {
    return errorResponse(null, -32600, "Invalid JSON-RPC request.");
  }

  const hasId = Object.hasOwn(message, "id");
  if (
    hasId &&
    !(
      typeof message.id === "string" ||
      (typeof message.id === "number" && Number.isFinite(message.id))
    )
  ) {
    return errorResponse(null, -32600, "Request id must be a string or number.");
  }

  if (!hasId) return null;

  const id = message.id;
  const params =
    message.params === undefined
      ? {}
      : message.params && typeof message.params === "object" && !Array.isArray(message.params)
        ? message.params
        : null;

  if (!params) return errorResponse(id, -32602, "params must be an object.");

  const requestedVersion =
    params._meta?.["io.modelcontextprotocol/protocolVersion"] ||
    protocolVersion ||
    "2025-11-25";

  if (!MCP_SUPPORTED_VERSIONS.includes(requestedVersion)) {
    return errorResponse(id, -32022, "Unsupported protocol version.", {
      supported: MCP_SUPPORTED_VERSIONS,
    });
  }

  const modern = requestedVersion === "2026-07-28";

  try {
    let result;
    let cacheable = false;

    switch (message.method) {
      case "server/discover":
        return { jsonrpc: "2.0", id, result: discoverWritingAssistantMcp() };
      case "initialize": {
        if (modern) {
          return errorResponse(id, -32601, "Use server/discover for protocol 2026-07-28.");
        }
        if (
          typeof params.protocolVersion !== "string" ||
          !isObject(params.clientInfo) ||
          typeof params.clientInfo.name !== "string" ||
          typeof params.clientInfo.version !== "string" ||
          !isObject(params.capabilities)
        ) {
          return errorResponse(
            id,
            -32602,
            "initialize requires protocolVersion, clientInfo with name and version, and a capabilities object.",
          );
        }
        const negotiated =
          MCP_SUPPORTED_VERSIONS.includes(params.protocolVersion) &&
          params.protocolVersion !== "2026-07-28"
            ? params.protocolVersion
            : "2025-11-25";
        result = {
          protocolVersion: negotiated,
          serverInfo: MCP_SERVER_INFO,
          capabilities: { tools: {}, resources: {} },
          instructions: MCP_INSTRUCTIONS,
        };
        break;
      }
      case "ping":
        result = {};
        break;
      case "tools/list":
        result = { tools: getWritingAssistantTools() };
        cacheable = true;
        break;
      case "resources/list":
        result = { resources: getWritingDiagnosticResourceList() };
        cacheable = true;
        break;
      case "resources/read":
        if (typeof params.uri !== "string") {
          return errorResponse(id, -32602, "resources/read requires a resource URI.");
        }
        result = await readWritingDiagnosticResource(params.uri);
        cacheable = true;
        break;
      case "tools/call":
        if (typeof params.name !== "string") {
          return errorResponse(id, -32602, "tools/call requires a tool name.");
        }
        result = await callWritingAssistantTool(
          params.name,
          params.arguments === undefined ? {} : params.arguments,
        );
        break;
      default:
        return errorResponse(id, -32601, `Method not found: ${message.method}`);
    }

    return {
      jsonrpc: "2.0",
      id,
      result: modern ? modernResult(result, cacheable) : result,
    };
  } catch {
    return errorResponse(id, -32603, "Internal server error.");
  }
}
