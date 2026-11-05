/**
 * Documented API & Extension Contracts for HireLoop AI
 * Grounded in Major_Project_doc.md.pdf (Section 3.3 & 3.4) and Parth's Execution Guide.
 */

export type SupportedFieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  | 'date'
  | 'select'
  | 'textarea'
  | 'radio'
  | 'checkbox'
  | 'combobox'
  | 'file';

/**
 * Single form field descriptor produced by Phase A Client-Side DOM Distillation
 * and sent inside POST /api/v1/map-fields for fields unresolved by Tier 1.
 */
export interface DistilledField {
  field_uid: string;
  label_text: string;
  section_header: string;
  field_type: SupportedFieldType;
  automation_id: string;
  options?: string[];
  required: boolean;
}

/**
 * Summary telemetry for Phase A DOM Distillation to verify the <400 token engineering target.
 */
export interface DistillationResult {
  portal_domain: string;
  fields: DistilledField[];
  estimated_tokens: number;
  scanned_at: string;
}

/**
 * Endpoint 1: POST /api/v1/map-fields (Request Payload)
 * NOTE FOR SHUBH: Confirm whether portal_domain expects hostname ("boards.greenhouse.io")
 * or a portal label ("Greenhouse_Portal").
 */
export interface MapFieldsRequest {
  candidate_id: string;
  portal_domain: string;
  fields: DistilledField[];
}

/**
 * Resolution action returned by backend or derived from confidence_score thresholds:
 * - >= 0.80: AUTO_FILL (Soft Green)
 * - 0.50 - 0.79: GHOST_TEXT (Inline suggestion accepted via Tab)
 * - < 0.50 or Legal Attestation: NEEDS_USER_INPUT (Amber manual review)
 */
export type ResolutionAction = 'AUTO_FILL' | 'GHOST_TEXT' | 'NEEDS_USER_INPUT';

export interface MappedFieldResolution {
  field_uid: string;
  proposed_value: string | null;
  confidence_score: number;
  action: ResolutionAction;
  supporting_evidence_id: string | null;
}

/**
 * Endpoint 1: POST /api/v1/map-fields (Response Payload)
 */
export interface MapFieldsResponse {
  mapped_fields: MappedFieldResolution[];
}

/**
 * Endpoint 2: POST /api/v1/learn-edits (Request Payload sent on form blur/submit)
 */
export interface LearnedFieldEdit {
  label_text: string;
  field_type: string;
  initial_ai_value: string | null;
  final_user_value: string;
}

export interface LearnEditsRequest {
  candidate_id: string;
  portal_domain: string;
  edits: LearnedFieldEdit[];
}

/**
 * Candidate profile cached in chrome.storage.local for Tier 1 (0-token, <15ms) matching.
 */
export interface CandidateLocalProfile {
  candidate_id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  full_name: string;
  email: string;
  phone_code: string;
  phone_number: string;
  street_address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
  current_company?: string;
  current_title?: string;
}