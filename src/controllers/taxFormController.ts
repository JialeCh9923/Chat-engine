import { Request, Response } from 'express';
import { taxFormService } from '../services/taxFormService';
import logger from '../utils/logger';
import { CustomApiError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Tax form controller for handling tax form operations
 */
export class TaxFormController {
  /**
   * Create a new tax form
   */
  static async createTaxForm(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { formType, taxYear, filingStatus, data, metadata } = req.body;

      // Verify session ownership
      if (req.session && req.session.sessionId !== sessionId) {
        throw new CustomApiError('Access denied to session', 403);
      }

      const taxForm = await taxFormService.createTaxForm(
        sessionId,
        formType,
        taxYear,
        filingStatus,
        data,
        metadata
      );

      logger.info('Tax form created via API', {
        formId: taxForm.formId,
        sessionId,
        formType,
        taxYear,
        clientId: req.client?.clientId,
      });

      res.status(201).json({
        success: true,
        data: {
          formId: taxForm.formId,
          sessionId: taxForm.sessionId,
          formType: taxForm.formType,
          taxYear: taxForm.taxYear,
          filingStatus: taxForm.filingStatus,
          status: taxForm.status,
          validation: taxForm.validation,
          createdAt: taxForm.createdAt,
          metadata: {
            version: taxForm.metadata.version,
            tags: taxForm.metadata.tags,
            notes: taxForm.metadata.notes,
          },
        },
        message: 'Tax form created successfully',
      });
    } catch (error) {
      logger.error('Failed to create tax form via API', {
        error,
        sessionId: req.params.sessionId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to create tax form', 500);
    }
  }

  /**
   * Get tax form by ID
   */
  static async getTaxForm(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { formId } = req.params;

      const taxForm = await taxFormService.getTaxForm(formId);

      if (!taxForm) {
        throw new CustomApiError('Tax form not found', 404);
      }

      // Verify session ownership
      if (req.session && req.session.sessionId !== taxForm.sessionId) {
        throw new CustomApiError('Access denied to tax form', 403);
      }

      logger.debug('Tax form retrieved via API', {
        formId,
        clientId: req.client?.clientId,
      });

      res.json({
        success: true,
        data: {
          formId: taxForm.formId,
          sessionId: taxForm.sessionId,
          formType: taxForm.formType,
          taxYear: taxForm.taxYear,
          filingStatus: taxForm.filingStatus,
          status: taxForm.status,
          data: taxForm.data,
          validation: taxForm.validation,
          createdAt: taxForm.createdAt,
          updatedAt: taxForm.updatedAt,
          metadata: taxForm.metadata,
          attachments: taxForm.attachments,
        },
      });
    } catch (error) {
      logger.error('Failed to get tax form via API', {
        error,
        formId: req.params.formId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to retrieve tax form', 500);
    }
  }

  /**
   * Get tax forms by session
   */
  static async getTaxFormsBySession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const {
        formType,
        taxYear,
        status,
        page = '1',
        limit = '20',
        sort = 'createdAt',
        order = 'desc',
      } = req.query;

      // Verify session ownership
      if (req.session && req.session.sessionId !== sessionId) {
        throw new CustomApiError('Access denied to session', 403);
      }

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const sortOrder = order === 'asc' ? 1 : -1;
      const sortObj = { [sort as string]: sortOrder };

      const taxForms = await taxFormService.getTaxFormsBySession(sessionId, {
        formType: formType as string,
        taxYear: taxYear ? parseInt(taxYear as string, 10) : undefined,
        status: status as string,
        limit: limitNum,
        skip,
        sort: sortObj,
      });

      logger.debug('Tax forms retrieved by session via API', {
        sessionId,
        count: taxForms.length,
        clientId: req.client?.clientId,
      });

      res.json({
        success: true,
        data: taxForms.map(form => ({
          formId: form.formId,
          sessionId: form.sessionId,
          formType: form.formType,
          taxYear: form.taxYear,
          filingStatus: form.filingStatus,
          status: form.status,
          validation: form.validation,
          createdAt: form.createdAt,
          updatedAt: form.updatedAt,
          metadata: {
            version: form.metadata.version,
            tags: form.metadata.tags,
            notes: form.metadata.notes,
          },
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: taxForms.length,
          hasMore: taxForms.length === limitNum,
        },
      });
    } catch (error) {
      logger.error('Failed to get tax forms by session via API', {
        error,
        sessionId: req.params.sessionId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to retrieve tax forms', 500);
    }
  }

  /**
   * Update tax form
   */
  static async updateTaxForm(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { formId } = req.params;
      const { data, status, metadata } = req.body;

      const taxForm = await taxFormService.getTaxForm(formId);

      if (!taxForm) {
        throw new CustomApiError('Tax form not found', 404);
      }

      // Verify session ownership
      if (req.session && req.session.sessionId !== taxForm.sessionId) {
        throw new CustomApiError('Access denied to tax form', 403);
      }

      const updatedTaxForm = await taxFormService.updateTaxForm(formId, {
        data,
        status,
        metadata,
      });

      if (!updatedTaxForm) {
        throw new CustomApiError('Failed to update tax form', 500);
      }

      logger.info('Tax form updated via API', {
        formId,
        version: updatedTaxForm.metadata.version,
        clientId: req.client?.clientId,
        updates: Object.keys(req.body),
      });

      res.json({
        success: true,
        data: {
          formId: updatedTaxForm.formId,
          sessionId: updatedTaxForm.sessionId,
          formType: updatedTaxForm.formType,
          taxYear: updatedTaxForm.taxYear,
          filingStatus: updatedTaxForm.filingStatus,
          status: updatedTaxForm.status,
          data: updatedTaxForm.data,
          validation: updatedTaxForm.validation,
          createdAt: updatedTaxForm.createdAt,
          updatedAt: updatedTaxForm.updatedAt,
          metadata: updatedTaxForm.metadata,
        },
        message: 'Tax form updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update tax form via API', {
        error,
        formId: req.params.formId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to update tax form', 500);
    }
  }

  /**
   * Delete tax form
   */
  static async deleteTaxForm(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { formId } = req.params;

      const taxForm = await taxFormService.getTaxForm(formId);

      if (!taxForm) {
        throw new CustomApiError('Tax form not found', 404);
      }

      // Verify session ownership
      if (req.session && req.session.sessionId !== taxForm.sessionId) {
        throw new CustomApiError('Access denied to tax form', 403);
      }

      const deleted = await taxFormService.deleteTaxForm(formId);

      if (!deleted) {
        throw new CustomApiError('Failed to delete tax form', 500);
      }

      logger.info('Tax form deleted via API', {
        formId,
        clientId: req.client?.clientId,
      });

      res.json({
        success: true,
        message: 'Tax form deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete tax form via API', {
        error,
        formId: req.params.formId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to delete tax form', 500);
    }
  }

  /**
   * Calculate taxes with AI
   */
  static async calculateTaxes(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { formId } = req.params;

      const taxForm = await taxFormService.getTaxForm(formId);

      if (!taxForm) {
        throw new CustomApiError('Tax form not found', 404);
      }

      // Verify session ownership
      if (req.session && req.session.sessionId !== taxForm.sessionId) {
        throw new CustomApiError('Access denied to tax form', 403);
      }

      const result = await taxFormService.calculateTaxesWithAI(formId);

      if (!result) {
        throw new CustomApiError('Failed to start tax calculation', 500);
      }

      logger.info('Tax calculation started via API', {
        formId,
        clientId: req.client?.clientId,
      });

      res.json({
        success: true,
        data: {
          formId,
          calculationStarted: true,
          message: 'Tax calculation job has been queued',
        },
        message: 'Tax calculation started successfully',
      });
    } catch (error) {
      logger.error('Failed to calculate taxes via API', {
        error,
        formId: req.params.formId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to calculate taxes', 500);
    }
  }

  /**
   * Generate form suggestions
   */
  static async generateFormSuggestions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const userInfo = req.body;

      // Verify session ownership
      if (req.session && req.session.sessionId !== sessionId) {
        throw new CustomApiError('Access denied to session', 403);
      }

      const suggestions = await taxFormService.generateFormSuggestions(sessionId, userInfo);

      logger.info('Form suggestions generated via API', {
        sessionId,
        suggestedForms: suggestions.suggestedForms,
        clientId: req.client?.clientId,
      });

      res.json({
        success: true,
        data: suggestions,
        message: 'Form suggestions generated successfully',
      });
    } catch (error) {
      logger.error('Failed to generate form suggestions via API', {
        error,
        sessionId: req.params.sessionId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to generate form suggestions', 500);
    }
  }

  /**
   * Validate tax calculations
   */
  static async validateCalculations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { formId } = req.params;

      const taxForm = await taxFormService.getTaxForm(formId);

      if (!taxForm) {
        throw new CustomApiError('Tax form not found', 404);
      }

      // Verify session ownership
      if (req.session && req.session.sessionId !== taxForm.sessionId) {
        throw new CustomApiError('Access denied to tax form', 403);
      }

      const validation = await taxFormService.validateTaxCalculations(formId);

      logger.info('Tax calculations validated via API', {
        formId,
        isValid: validation.isValid,
        clientId: req.client?.clientId,
      });

      res.json({
        success: true,
        data: validation,
        message: 'Tax calculations validated successfully',
      });
    } catch (error) {
      logger.error('Failed to validate tax calculations via API', {
        error,
        formId: req.params.formId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to validate tax calculations', 500);
    }
  }

  /**
   * Export tax form
   */
  static async exportTaxForm(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { formId } = req.params;
      const { format = 'json' } = req.query;

      const taxForm = await taxFormService.getTaxForm(formId);

      if (!taxForm) {
        throw new CustomApiError('Tax form not found', 404);
      }

      // Verify session ownership
      if (req.session && req.session.sessionId !== taxForm.sessionId) {
        throw new CustomApiError('Access denied to tax form', 403);
      }

      const exportData = await taxFormService.exportTaxForm(
        formId,
        format as 'json' | 'pdf' | 'xml'
      );

      logger.info('Tax form exported via API', {
        formId,
        format,
        clientId: req.client?.clientId,
      });

      res.setHeader('Content-Type', exportData.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportData.filename}"`);
      
      res.send(exportData.data);
    } catch (error) {
      logger.error('Failed to export tax form via API', {
        error,
        formId: req.params.formId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to export tax form', 500);
    }
  }

  /**
   * Import tax form
   */
  static async importTaxForm(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { data, format = 'json' } = req.body;

      // Verify session ownership
      if (req.session && req.session.sessionId !== sessionId) {
        throw new CustomApiError('Access denied to session', 403);
      }

      const taxForm = await taxFormService.importTaxForm(
        sessionId,
        data,
        format as 'json' | 'xml'
      );

      logger.info('Tax form imported via API', {
        formId: taxForm.formId,
        sessionId,
        format,
        clientId: req.client?.clientId,
      });

      res.status(201).json({
        success: true,
        data: {
          formId: taxForm.formId,
          sessionId: taxForm.sessionId,
          formType: taxForm.formType,
          taxYear: taxForm.taxYear,
          filingStatus: taxForm.filingStatus,
          status: taxForm.status,
          createdAt: taxForm.createdAt,
        },
        message: 'Tax form imported successfully',
      });
    } catch (error) {
      logger.error('Failed to import tax form via API', {
        error,
        sessionId: req.params.sessionId,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to import tax form', 500);
    }
  }

  /**
   * Get tax form statistics
   */
  static async getTaxFormStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const stats = await taxFormService.getTaxFormStats();

      logger.debug('Tax form statistics retrieved via API', {
        clientId: req.client?.clientId,
      });

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to get tax form statistics via API', {
        error,
        clientId: req.client?.clientId,
      });
      
      if (error instanceof CustomApiError) {
        throw error;
      }
      
      throw new CustomApiError('Failed to retrieve tax form statistics', 500);
    }
  }

  /**
   * Health check
   */
  static async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const stats = await taxFormService.getTaxFormStats();

      res.json({
        success: true,
        service: 'TaxFormService',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        stats: {
          totalForms: stats.total,
          completionRate: Math.round(stats.completionRate),
          formTypes: Object.keys(stats.byType).length,
        },
      });
    } catch (error) {
      logger.error('Tax form service health check failed', { error });
      
      res.status(503).json({
        success: false,
        service: 'TaxFormService',
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}