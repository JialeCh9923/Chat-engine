import { Router, RequestHandler } from 'express';
import { ClientController } from '../controllers/clientController';
import {
  validateCreateClient,
  validateClientId,
  validatePagination,
  handleValidationErrors,
} from '../middleware/validation';
import { clientRateLimiter, sensitiveOperationRateLimiter } from '../middleware';
import { authenticateApiKey, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Type helper to cast authenticated handlers
const authHandler = (handler: (req: AuthenticatedRequest, res: any) => Promise<void>): RequestHandler => {
  return handler as RequestHandler;
};

// Apply client-specific rate limiting
// router.use(clientRateLimiter);

/**
 * @route   POST /api/clients
 * @desc    Create a new client (no authentication required for initial setup)
 * @access  Public
 */
router.post(
  '/',
  // sensitiveOperationRateLimiter, // Apply sensitive operation rate limiting
  validateCreateClient,
  handleValidationErrors,
  ClientController.createClient
);

/**
 * @route   GET /api/clients/health
 * @desc    Client service health check
 * @access  Public
 */
router.get(
  '/health',
  ClientController.healthCheck
);

// Apply authentication to all routes below
router.use(authenticateApiKey);

/**
 * @route   GET /api/clients/:clientId
 * @desc    Get client by ID
 * @access  Private (API Key required)
 */
router.get(
  '/:clientId',
  validateClientId,
  handleValidationErrors,
  authHandler(ClientController.getClient)
);

/**
 * @route   GET /api/clients
 * @desc    Get all clients (admin only)
 * @access  Private (Admin API Key required)
 */
router.get(
  '/',
  validatePagination,
  handleValidationErrors,
  authHandler(ClientController.getAllClients)
);

/**
 * @route   PUT /api/clients/:clientId
 * @desc    Update client
 * @access  Private (API Key required - own client or admin)
 */
router.put(
  '/:clientId',
  validateClientId,
  handleValidationErrors,
  authHandler(ClientController.updateClient)
);

/**
 * @route   DELETE /api/clients/:clientId
 * @desc    Delete client (admin only)
 * @access  Private (Admin API Key required)
 */
router.delete(
  '/:clientId',
  // sensitiveOperationRateLimiter,
  validateClientId,
  handleValidationErrors,
  authHandler(ClientController.deleteClient)
);

/**
 * @route   POST /api/clients/:clientId/regenerate-key
 * @desc    Regenerate API key
 * @access  Private (API Key required - own client or admin)
 */
router.post(
  '/:clientId/regenerate-key',
  // sensitiveOperationRateLimiter,
  validateClientId,
  handleValidationErrors,
  authHandler(ClientController.regenerateApiKey)
);

/**
 * @route   GET /api/clients/:clientId/usage
 * @desc    Get client usage statistics
 * @access  Private (API Key required - own client or admin)
 */
router.get(
  '/:clientId/usage',
  validateClientId,
  handleValidationErrors,
  authHandler(ClientController.getClientUsage)
);

/**
 * @route   PUT /api/clients/:clientId/usage
 * @desc    Update client usage
 * @access  Private (API Key required - own client only)
 */
router.put(
  '/:clientId/usage',
  validateClientId,
  handleValidationErrors,
  authHandler(ClientController.updateClientUsage)
);

export { router as clientRoutes };