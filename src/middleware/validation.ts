// =================================================================
// VALIDATION MIDDLEWARE - Input validation and sanitization
// =================================================================

/**
 * Validation middleware for Gomoku server
 *
 * Why validation is critical?
 * - Prevent invalid moves that could crash AI
 * - Sanitize inputs to prevent injection attacks
 * - Ensure data integrity across the system
 * - Provide clear error messages for debugging
 */

// Validation schemas for different endpoints
interface ValidationSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required?: boolean;
    min?: number;
    max?: number;
    enum?: any[];
    pattern?: RegExp;
    schema?: ValidationSchema; // For nested objects
  };
}

// Quick start validation schema
const QUICK_START_SCHEMA: ValidationSchema = {
  playerSymbol: {
    type: 'string',
    required: false,
    enum: ['X', 'O']
  }
};

// Move request validation schema
const MOVE_SCHEMA: ValidationSchema = {
  playerId: {
    type: 'string',
    required: true,
    pattern: /^[a-zA-Z0-9_-]+$/
  },
  row: {
    type: 'number',
    required: true,
    min: 0,
    max: 14
  },
  col: {
    type: 'number',
    required: true,
    min: 0,
    max: 14
  }
};

// WebSocket message validation schema
const WEBSOCKET_MESSAGE_SCHEMA: ValidationSchema = {
  type: {
    type: 'string',
    required: true,
    enum: ['ping', 'move_request', 'game_state_request']
  },
  row: {
    type: 'number',
    required: false, // Only for move_request
    min: 0,
    max: 14
  },
  col: {
    type: 'number',
    required: false, // Only for move_request
    min: 0,
    max: 14
  }
};

/**
 * Validation result interface
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: any;
}

/**
 * Validates a single field against its schema
 */
const validateField = (
  value: any,
  fieldName: string,
  fieldSchema: any
): { isValid: boolean; error?: string; sanitizedValue?: any } => {

  // Check required fields
  if (fieldSchema.required && (value === undefined || value === null)) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  // Skip validation for optional undefined fields
  if (!fieldSchema.required && (value === undefined || value === null)) {
    return { isValid: true, sanitizedValue: value };
  }

  // Type validation
  const actualType = Array.isArray(value) ? 'array' : typeof value;
  if (actualType !== fieldSchema.type) {
    return {
      isValid: false,
      error: `${fieldName} must be of type ${fieldSchema.type}, got ${actualType}`
    };
  }

  let sanitizedValue = value;

  // String validations
  if (fieldSchema.type === 'string') {
    // Pattern validation
    if (fieldSchema.pattern && !fieldSchema.pattern.test(value)) {
      return {
        isValid: false,
        error: `${fieldName} format is invalid`
      };
    }

    // Enum validation
    if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
      return {
        isValid: false,
        error: `${fieldName} must be one of: ${fieldSchema.enum.join(', ')}`
      };
    }

    // Sanitize string (basic XSS prevention)
    sanitizedValue = value.toString().trim();
  }

  // Number validations
  if (fieldSchema.type === 'number') {
    if (fieldSchema.min !== undefined && value < fieldSchema.min) {
      return {
        isValid: false,
        error: `${fieldName} must be at least ${fieldSchema.min}`
      };
    }

    if (fieldSchema.max !== undefined && value > fieldSchema.max) {
      return {
        isValid: false,
        error: `${fieldName} must be at most ${fieldSchema.max}`
      };
    }

    // Ensure it's a valid number
    if (isNaN(value) || !isFinite(value)) {
      return {
        isValid: false,
        error: `${fieldName} must be a valid number`
      };
    }

    sanitizedValue = Number(value);
  }

  return { isValid: true, sanitizedValue };
};

/**
 * Validates data against a schema
 */
const validateData = (data: any, schema: ValidationSchema): ValidationResult => {
  const errors: string[] = [];
  const sanitizedData: any = {};

  // Validate each field in the schema
  for (const [fieldName, fieldSchema] of Object.entries(schema)) {
    const result = validateField(data[fieldName], fieldName, fieldSchema);

    if (!result.isValid) {
      errors.push(result.error!);
    } else {
      sanitizedData[fieldName] = result.sanitizedValue;
    }
  }

  // Check for unexpected fields (strict mode)
  for (const fieldName of Object.keys(data)) {
    if (!schema[fieldName]) {
      console.warn(`⚠️ Unexpected field in request: ${fieldName}`);
      // Don't fail validation, just warn
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: errors.length === 0 ? sanitizedData : undefined
  };
};

/**
 * Validates quick start request
 */
export const validateQuickStartRequest = (data: any): ValidationResult => {
  console.log('🔍 Validating quick start request');
  return validateData(data, QUICK_START_SCHEMA);
};

/**
 * Validates move request
 */
export const validateMoveRequest = (data: any): ValidationResult => {
  console.log('🔍 Validating move request');
  return validateData(data, MOVE_SCHEMA);
};

/**
 * Validates WebSocket message
 */
export const validateWebSocketMessage = (data: any): ValidationResult => {
  console.log('🔍 Validating WebSocket message');

  const result = validateData(data, WEBSOCKET_MESSAGE_SCHEMA);

  // Additional validation based on message type
  if (result.isValid && data.type === 'move_request') {
    if (data.row === undefined || data.col === undefined) {
      return {
        isValid: false,
        errors: ['move_request requires row and col fields']
      };
    }
  }

  return result;
};

/**
 * Validates path parameters
 */
export const validatePathParams = (params: Record<string, string>): ValidationResult => {
  const errors: string[] = [];
  const sanitizedParams: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    if (!value || value.trim() === '') {
      errors.push(`${key} parameter is required`);
      continue;
    }

    // Basic sanitization
    let sanitizedValue = value.trim();

    // Specific validation based on parameter name
    switch (key) {
      case 'gameId':
      case 'roomId':
        // Should be alphanumeric with some special chars
        if (!/^[a-zA-Z0-9_-]+$/.test(sanitizedValue)) {
          errors.push(`${key} contains invalid characters`);
          continue;
        }
        break;

      case 'connectionId':
        // WebSocket connection IDs have specific format
        if (!/^ws_[a-zA-Z0-9_]+$/.test(sanitizedValue)) {
          errors.push(`${key} has invalid format`);
          continue;
        }
        break;
    }

    sanitizedParams[key] = sanitizedValue;
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: errors.length === 0 ? sanitizedParams : undefined
  };
};

/**
 * Validates query parameters
 */
export const validateQueryParams = (
  url: URL,
  requiredParams: string[] = [],
  optionalParams: string[] = []
): ValidationResult => {
  const errors: string[] = [];
  const sanitizedParams: Record<string, string> = {};

  // Check required parameters
  for (const param of requiredParams) {
    const value = url.searchParams.get(param);
    if (!value) {
      errors.push(`Query parameter '${param}' is required`);
      continue;
    }

    sanitizedParams[param] = value.trim();
  }

  // Check optional parameters
  for (const param of optionalParams) {
    const value = url.searchParams.get(param);
    if (value) {
      sanitizedParams[param] = value.trim();
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: errors.length === 0 ? sanitizedParams : undefined
  };
};

/**
 * Middleware function for request validation
 */
export const validationMiddleware = (
  request: Request,
  validationType: 'quickStart' | 'move' | 'pathParams' | 'queryParams',
  options?: any
): Promise<ValidationResult> => {
  return new Promise(async (resolve) => {
    try {
      switch (validationType) {
        case 'quickStart':
          const quickStartBody = await request.text();
          const quickStartData = quickStartBody ? JSON.parse(quickStartBody) : {};
          resolve(validateQuickStartRequest(quickStartData));
          break;

        case 'move':
          const moveBody = await request.text();
          const moveData = JSON.parse(moveBody);
          resolve(validateMoveRequest(moveData));
          break;

        case 'pathParams':
          resolve(validatePathParams(options.params));
          break;

        case 'queryParams':
          const url = new URL(request.url);
          resolve(validateQueryParams(url, options.required, options.optional));
          break;

        default:
          resolve({
            isValid: false,
            errors: ['Unknown validation type']
          });
      }
    } catch (error) {
      console.error('❌ Validation error:', error);
      resolve({
        isValid: false,
        errors: ['Invalid request format']
      });
    }
  });
};

/**
 * Creates validation error response
 */
export const createValidationErrorResponse = (errors: string[]): Response => {
  return new Response(JSON.stringify({
    success: false,
    error: 'Validation failed',
    details: errors,
    timestamp: new Date().toISOString()
  }), {
    status: 400,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
};

/**
 * Sanitizes HTML content (basic XSS prevention)
 */
export const sanitizeHtml = (input: string): string => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Validates and sanitizes user input for logging
 */
export const sanitizeForLog = (input: any): string => {
  if (typeof input === 'string') {
    return sanitizeHtml(input).substring(0, 200); // Limit length
  }

  if (typeof input === 'object') {
    try {
      return JSON.stringify(input).substring(0, 500);
    } catch {
      return '[Invalid Object]';
    }
  }

  return String(input).substring(0, 100);
};

// Export validation schemas for testing
export const validationSchemas = {
  QUICK_START_SCHEMA,
  MOVE_SCHEMA,
  WEBSOCKET_MESSAGE_SCHEMA
};