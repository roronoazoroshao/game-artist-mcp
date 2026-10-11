#!/usr/bin/env node
import { assessHostCapabilities } from '../src/provenance/host-capabilities.mjs';
const documentedMechanisms = [
  { kind: 'OPENAI_CALL_ID', documentationUrl: 'https://developers.openai.com/api/docs/guides/function-calling' },
  { kind: 'ANTHROPIC_TOOL_USE', documentationUrl: 'https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works' },
  { kind: 'MCP_TOOL_RESULT', documentationUrl: 'https://modelcontextprotocol.io/specification/2025-11-25/server/tools' },
  { kind: 'GITHUB_BUILD_ATTESTATION', documentationUrl: 'https://docs.github.com/en/actions/concepts/security/artifact-attestations' },
];
const result = assessHostCapabilities({ documentedMechanisms, availableTools: [] });
process.stdout.write(`${JSON.stringify({ assessmentVersion: 1, evidenceKind: 'OPERATOR_DOC_REVIEW',
  assessment: result }, null, 2)}\n`);
