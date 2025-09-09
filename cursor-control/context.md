# Project Context

Project: Prep101 (Child Actor 101)  
Goal: Convert PDF sides + metadata (role, genre, type, etc.) into a styled HTML audition prep guide email.

## Pipelines
- Airtable → (record with PDF + fields) → n8n worker → OpenAI Assistant → HTML guide → Gmail/Airtable Automations.

## Constraints
- HTML-only emails, inlined styles; no external CSS.
- Guides must include Uta Hagen 9Q + genre-aware sections (comedy beats, etc.).
- Depth must match "Henry" example.

## Open Issues (update daily)
- [ ] Retry policy for Assistant timeouts
- [ ] HTML template unit tests (schema & critical sections)

---

# Current Implementation Context (2025-01-27)
**Note: Current codebase differs from intended architecture**

## What's Actually Built
- React frontend (not Next.js 14)
- Express.js backend with PostgreSQL (not Airtable + Supabase)
- Direct PDF processing with OCR (not n8n worker pipeline)
- Web-based guide generation and viewing (not email-only output)
- User authentication and account management system
- Guide storage and retrieval from database

## Key Components Working
- PDF upload and text extraction
- Guide generation with RAG methodology
- User authentication and authorization
- Guide persistence in PostgreSQL
- Account management interface

## Recent Fixes Applied
- Fixed authentication token passing in FileUpload
- Resolved guide database saving issues
- Updated Account page to show real guides
- Enhanced error handling and user feedback

## Architecture Decision Needed
- Migrate to intended Next.js + Airtable architecture?
- Or update project rules to reflect current working implementation?
- Current system is functional but doesn't match documented architecture
