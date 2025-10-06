import { Router, RequestHandler } from 'express';
import { TaxFormController } from '../controllers/taxFormController';
import {
  validateCreateTaxForm,
  validateFormId,
  validateSessionId,
  validateUpdateTaxForm,
  validatePagination,
  handleValidationErrors,
} from '../middleware/validation';
import { sensitiveOperationRateLimiter } from '../middleware/rateLimiter';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Type helper to cast authenticated handlers
const authHandler = (handler: (req: AuthenticatedRequest, res: any) => Promise<void>): RequestHandler => {
  return handler as RequestHandler;
};

/**
 * @route   POST /api/tax-forms/:sessionId
 * @desc    Create a new tax form
 * @access  Private (API Key required)
 */
router.post(
  '/:sessionId',
  sensitiveOperationRateLimiter, // Apply sensitive operation rate limiting
  validateSessionId,
  validateCreateTaxForm,
  handleValidationErrors,
  authHandler(TaxFormController.createTaxForm)
);

/**
 * @route   GET /api/tax-forms/:formId
 * @desc    Get tax form by ID
 * @access  Private (API Key required)
 */
router.get(
  '/:formId',
  validateFormId,
  handleValidationErrors,
  authHandler(TaxFormController.getTaxForm)
);

/**
 * @route   GET /api/tax-forms/session/:sessionId
 * @desc    Get tax forms by session
 * @access  Private (API Key required)
 */
router.get(
  '/session/:sessionId',
  validateSessionId,
  validatePagination,
  handleValidationErrors,
  authHandler(TaxFormController.getTaxFormsBySession)
);

/**
 * @route   PUT /api/tax-forms/:formId
 * @desc    Update tax form
 * @access  Private (API Key required)
 */
router.put(
  '/:formId',
  validateFormId,
  validateUpdateTaxForm,
  handleValidationErrors,
  authHandler(TaxFormController.updateTaxForm)
);

/**
 * @route   DELETE /api/tax-forms/:formId
 * @desc    Delete tax form
 * @access  Private (API Key required)
 */
router.delete(
  '/:formId',
  validateFormId,
  handleValidationErrors,
  authHandler(TaxFormController.deleteTaxForm)
);

/**
 * @route   POST /api/tax-forms/:formId/calculate
 * @desc    Calculate taxes with AI
 * @access  Private (API Key required)
 */
router.post(
  '/:formId/calculate',
  sensitiveOperationRateLimiter,
  validateFormId,
  handleValidationErrors,
  authHandler(TaxFormController.calculateTaxes)
);

/**
 * @route   POST /api/tax-forms/session/:sessionId/suggestions
 * @desc    Generate form suggestions
 * @access  Private (API Key required)
 */
router.post(
  '/session/:sessionId/suggestions',
  validateSessionId,
  handleValidationErrors,
  authHandler(TaxFormController.generateFormSuggestions)
);

/**
 * @route   POST /api/tax-forms/:formId/validate
 * @desc    Validate tax calculations
 * @access  Private (API Key required)
 */
router.post(
  '/:formId/validate',
  validateFormId,
  handleValidationErrors,
  authHandler(TaxFormController.validateCalculations)
);

/**
 * @route   GET /api/tax-forms/:formId/export
 * @desc    Export tax form
 * @access  Private (API Key required)
 */
router.get(
  '/:formId/export',
  validateFormId,
  handleValidationErrors,
  authHandler(TaxFormController.exportTaxForm)
);

/**
 * @route   POST /api/tax-forms/session/:sessionId/import
 * @desc    Import tax form
 * @access  Private (API Key required)
 */
router.post(
  '/session/:sessionId/import',
  sensitiveOperationRateLimiter,
  validateSessionId,
  handleValidationErrors,
  authHandler(TaxFormController.importTaxForm)
);

/**
 * @route   GET /api/tax-forms/stats
 * @desc    Get tax form statistics
 * @access  Private (API Key required)
 */
router.get(
  '/stats',
  authHandler(TaxFormController.getTaxFormStats)
);

/**
 * @route   GET /api/tax-forms/health
 * @desc    Tax form service health check
 * @access  Public
 */
router.get(
  '/health',
  TaxFormController.healthCheck
);

export { router as taxFormRoutes };