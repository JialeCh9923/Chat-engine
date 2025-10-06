import { Request, Response } from 'express';
import { clientService } from '../services/clientService';
import logger from '../utils/logger';
import { CustomApiError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Client controller for handling client operations
 */
export class ClientController {
  /**
   * Create a new client
   */
  static async createClient(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, permissions } = req.body;

      const client = await clientService.createClient(name, email, permissions);

      logger.info('Client created via API', {
        clientId: client.clientId,
        name,
        email,
      });

      res.status(201).json({
        success: true,
        data: {
          clientId: client.clientId,
          name: client.name,
          email: client.email,
          permissions: client.permissions,
          apiKey: client.apiKey,
          isActive: client.isActive,
          createdAt: client.createdAt,
        },
        message: 'Client created successfully',
      });
    } catch (error) {
      logger.error('Failed to create client via API', {
        error,
        name: req.body.name,
        email: req.body.email,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to create client', 500);
    }
  }

  /**
   * Get client by ID
   */
  static async getClient(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;

      // Only allow clients to view their own information
      if (req.client && req.client.clientId !== clientId) {
        throw new CustomApiError('Access denied', 403);
      }

      const client = await clientService.getClient(clientId);

      if (!client) {
        throw new CustomApiError('Client not found', 404);
      }

      logger.debug('Client retrieved via API', {
        clientId,
        requestingClientId: req.client?.clientId,
      });

      res.json({
        success: true,
        data: {
          clientId: client.clientId,
          name: client.name,
          email: client.email,
          permissions: client.permissions,
          isActive: client.isActive,
          createdAt: client.createdAt,
          updatedAt: client.updatedAt,
          lastAccessAt: client.lastAccessAt,
          usage: client.usage,
        },
      });
    } catch (error) {
      logger.error('Failed to get client via API', {
        error,
        clientId: req.params.clientId,
        requestingClientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to retrieve client', 500);
    }
  }

  /**
   * Get all clients (admin only)
   */
  static async getAllClients(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check if client has admin permissions
      if (!req.client?.permissions.includes('admin')) {
        throw new CustomApiError('Admin access required', 403);
      }

      const {
        page = '1',
        limit = '20',
        sort = 'createdAt',
        order = 'desc',
        isActive,
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const sortOrder: 1 | -1 = order === 'asc' ? 1 : -1;
      const sortObj: Record<string, 1 | -1> = { [sort as string]: sortOrder };

      const clients = await clientService.getAllClients({
        isActive: isActive ? isActive === 'true' : undefined,
        limit: limitNum,
        skip,
        sort: sortObj,
      });

      logger.debug('All clients retrieved via API', {
        count: clients.length,
        requestingClientId: req.client?.clientId,
      });

      res.json({
        success: true,
        data: clients.map(client => ({
          clientId: client.clientId,
          name: client.name,
          email: client.email,
          permissions: client.permissions,
          isActive: client.isActive,
          createdAt: client.createdAt,
          updatedAt: client.updatedAt,
          lastAccessAt: client.lastAccessAt,
          usage: client.usage,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: clients.length,
          hasMore: clients.length === limitNum,
        },
      });
    } catch (error) {
      logger.error('Failed to get all clients via API', {
        error,
        requestingClientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to retrieve clients', 500);
    }
  }

  /**
   * Update client
   */
  static async updateClient(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      const { name, email, permissions, isActive } = req.body;

      // Only allow clients to update their own information or admin to update any
      if (req.client && req.client.clientId !== clientId && !req.client.permissions.includes('admin')) {
        throw new CustomApiError('Access denied', 403);
      }

      const client = await clientService.getClient(clientId);

      if (!client) {
        throw new CustomApiError('Client not found', 404);
      }

      const updatedClient = await clientService.updateClient(clientId, {
        name,
        email,
        permissions,
        isActive,
      });

      if (!updatedClient) {
        throw new CustomApiError('Failed to update client', 500);
      }

      logger.info('Client updated via API', {
        clientId,
        requestingClientId: req.client?.clientId,
        updates: Object.keys(req.body),
      });

      res.json({
        success: true,
        data: {
          clientId: updatedClient.clientId,
          name: updatedClient.name,
          email: updatedClient.email,
          permissions: updatedClient.permissions,
          isActive: updatedClient.isActive,
          createdAt: updatedClient.createdAt,
          updatedAt: updatedClient.updatedAt,
          lastAccessAt: updatedClient.lastAccessAt,
          usage: updatedClient.usage,
        },
        message: 'Client updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update client via API', {
        error,
        clientId: req.params.clientId,
        requestingClientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to update client', 500);
    }
  }

  /**
   * Delete client (admin only)
   */
  static async deleteClient(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;

      // Check if client has admin permissions
      if (!req.client?.permissions.includes('admin')) {
        throw new CustomApiError('Admin access required', 403);
      }

      // Prevent self-deletion
      if (req.client.clientId === clientId) {
        throw new CustomApiError('Cannot delete your own client account', 400);
      }

      const client = await clientService.getClient(clientId);

      if (!client) {
        throw new CustomApiError('Client not found', 404);
      }

      const deleted = await clientService.deleteClient(clientId);

      if (!deleted) {
        throw new CustomApiError('Failed to delete client', 500);
      }

      logger.info('Client deleted via API', {
        clientId,
        requestingClientId: req.client?.clientId,
      });

      res.json({
        success: true,
        message: 'Client deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete client via API', {
        error,
        clientId: req.params.clientId,
        requestingClientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to delete client', 500);
    }
  }

  /**
   * Regenerate API key
   */
  static async regenerateApiKey(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;

      // Only allow clients to regenerate their own API key or admin to regenerate any
      if (req.client && req.client.clientId !== clientId && !req.client.permissions.includes('admin')) {
        throw new CustomApiError('Access denied', 403);
      }

      const client = await clientService.getClient(clientId);

      if (!client) {
        throw new CustomApiError('Client not found', 404);
      }

      const newApiKey = await clientService.regenerateApiKey(clientId);

      if (!newApiKey) {
        throw new CustomApiError('Failed to regenerate API key', 500);
      }

      logger.info('API key regenerated via API', {
        clientId,
        requestingClientId: req.client?.clientId,
      });

      res.json({
        success: true,
        data: {
          clientId,
          apiKey: newApiKey,
        },
        message: 'API key regenerated successfully',
      });
    } catch (error) {
      logger.error('Failed to regenerate API key via API', {
        error,
        clientId: req.params.clientId,
        requestingClientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to regenerate API key', 500);
    }
  }

  /**
   * Get client usage statistics
   */
  static async getClientUsage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;

      // Only allow clients to view their own usage or admin to view any
      if (req.client && req.client.clientId !== clientId && !req.client.permissions.includes('admin')) {
        throw new CustomApiError('Access denied', 403);
      }

      const client = await clientService.getClient(clientId);

      if (!client) {
        throw new CustomApiError('Client not found', 404);
      }

      const usage = await clientService.getClientUsage(clientId);

      logger.debug('Client usage retrieved via API', {
        clientId,
        requestingClientId: req.client?.clientId,
      });

      res.json({
        success: true,
        data: usage,
      });
    } catch (error) {
      logger.error('Failed to get client usage via API', {
        error,
        clientId: req.params.clientId,
        requestingClientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to retrieve client usage', 500);
    }
  }

  /**
   * Update client usage
   */
  static async updateClientUsage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      const { operation, amount = 1 } = req.body;

      // Only allow the client to update their own usage
      if (req.client && req.client.clientId !== clientId) {
        throw new CustomApiError('Access denied', 403);
      }

      const client = await clientService.getClient(clientId);

      if (!client) {
        throw new CustomApiError('Client not found', 404);
      }

      await clientService.updateClientUsage(clientId, operation, amount);

      logger.debug('Client usage updated via API', {
        clientId,
        operation,
        amount,
      });

      res.json({
        success: true,
        message: 'Client usage updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update client usage via API', {
        error,
        clientId: req.params.clientId,
        requestingClientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to update client usage', 500);
    }
  }

  /**
   * Health check
   */
  static async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const stats = await clientService.getClientStats();

      res.json({
        success: true,
        service: 'ClientService',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        stats: {
          totalClients: stats.total,
          activeClients: stats.active,
          inactiveClients: stats.inactive,
        },
      });
    } catch (error) {
      logger.error('Client service health check failed', { error });
      
      res.status(503).json({
        success: false,
        service: 'ClientService',
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}