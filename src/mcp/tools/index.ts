import { googleDriveListFiles, googleDriveDownloadFile } from './google-drive';
import { documentChunkAndEmbed } from './document-processor';
import { vectorSimilaritySearch } from './vector-search';
import { documentQAQuery } from './document-qa';

// Export all tools
export const tools = {
  // Google Drive tools
  google_drive_list_files: googleDriveListFiles,
  google_drive_download_file: googleDriveDownloadFile,
  
  // Document processing tools
  document_chunk_and_embed: documentChunkAndEmbed,
  
  // Vector search tools
  vector_similarity_search: vectorSimilaritySearch,
  
  // Document Q&A tools
  document_qa_query: documentQAQuery
};

// Export tool types
export type ToolName = keyof typeof tools;
