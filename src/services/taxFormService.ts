import TaxForm, { ITaxFormDocument } from '../models/TaxForm';
import { sessionService } from './sessionService';
import { openaiService } from './openaiService';
import { jobService } from './jobService';
import logger from '../utils/logger';
import { AuthUtils } from '../utils/auth';

/**
 * Tax form service for managing tax forms and calculations
 */
export class TaxFormService {
  private static instance: TaxFormService;

  constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): TaxFormService {
    if (!TaxFormService.instance) {
      TaxFormService.instance = new TaxFormService();
    }
    return TaxFormService.instance;
  }

  /**
   * Initialize the tax form service
   */
  async initialize(): Promise<void> {
    try {
      // Perform any initialization tasks
      logger.info('Tax form service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize tax form service', { error });
      throw error;
    }
  }

  /**
   * Create a new tax form
   */
  async createTaxForm(
    sessionId: string,
    formType: string,
    taxYear: number,
    filingStatus: string,
    data?: any,
    metadata?: any
  ): Promise<ITaxFormDocument> {
    try {
      // Verify session exists
      const session = await sessionService.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const formId = AuthUtils.generateUniqueId();

      const formData = {
        formId,
        sessionId,
        formType,
        taxYear,
        filingStatus,
        status: 'draft',
        data: {
          personalInfo: data?.personalInfo || {
            firstName: '',
            lastName: '',
            ssn: '',
            dateOfBirth: null,
            address: {
              street: '',
              city: '',
              state: '',
              zipCode: '',
            },
            phone: '',
            email: '',
            occupation: '',
          },
          income: data?.income || {
            wages: 0,
            interest: 0,
            dividends: 0,
            businessIncome: 0,
            capitalGains: 0,
            otherIncome: 0,
            totalIncome: 0,
          },
          deductions: data?.deductions || {
            standardDeduction: 0,
            itemizedDeductions: {
              stateAndLocalTaxes: 0,
              mortgageInterest: 0,
              charitableContributions: 0,
              medicalExpenses: 0,
              otherDeductions: 0,
              total: 0,
            },
            totalDeductions: 0,
          },
          credits: data?.credits || {
            childTaxCredit: 0,
            earnedIncomeCredit: 0,
            educationCredits: 0,
            otherCredits: 0,
            totalCredits: 0,
          },
          calculations: data?.calculations || {
            adjustedGrossIncome: 0,
            taxableIncome: 0,
            taxLiability: 0,
            totalPayments: 0,
            refundOrAmountDue: 0,
          },
        },
        validation: {
          errors: [],
          warnings: [],
          isValid: false,
        },
        metadata: {
          version: 1,
          revisionHistory: [],
          tags: metadata?.tags || [],
          notes: metadata?.notes || '',
          ...metadata,
        },
        attachments: [],
      };

      const taxForm = new TaxForm(formData);
      await taxForm.save();

      logger.info('Tax form created', {
        formId,
        sessionId,
        formType,
        taxYear,
        filingStatus,
      });

      return taxForm;
    } catch (error) {
      logger.error('Failed to create tax form', { error, sessionId, formType });
      throw error;
    }
  }

  /**
   * Get tax form by ID
   */
  async getTaxForm(formId: string): Promise<ITaxFormDocument | null> {
    try {
      const taxForm = await TaxForm.findByFormId(formId);
      
      if (taxForm) {
        logger.debug('Tax form retrieved', { formId });
      }

      return taxForm;
    } catch (error) {
      logger.error('Failed to get tax form', { error, formId });
      throw error;
    }
  }

  /**
   * Get tax forms by session
   */
  async getTaxFormsBySession(
    sessionId: string,
    options: {
      formType?: string;
      taxYear?: number;
      status?: string;
      limit?: number;
      skip?: number;
      sort?: any;
    } = {}
  ): Promise<ITaxFormDocument[]> {
    try {
      const query: any = { sessionId };
      
      if (options.formType) {
        query.formType = options.formType;
      }

      if (options.taxYear) {
        query.taxYear = options.taxYear;
      }

      if (options.status) {
        query.status = options.status;
      }

      const taxForms = await TaxForm.find(query)
        .sort(options.sort || { createdAt: -1 })
        .limit(options.limit || 50)
        .skip(options.skip || 0);

      logger.debug('Tax forms retrieved by session', {
        sessionId,
        count: taxForms.length,
        options,
      });

      return taxForms;
    } catch (error) {
      logger.error('Failed to get tax forms by session', { error, sessionId });
      throw error;
    }
  }

  /**
   * Update tax form
   */
  async updateTaxForm(
    formId: string,
    updates: {
      data?: any;
      status?: string;
      metadata?: any;
    }
  ): Promise<ITaxFormDocument | null> {
    try {
      const taxForm = await this.getTaxForm(formId);
      
      if (!taxForm) {
        return null;
      }

      // Create revision history entry
      const revision = {
        version: taxForm.metadata.version,
        timestamp: new Date(),
        changes: Object.keys(updates),
        updatedBy: 'system', // TODO: Get from request context
      };

      if (updates.data) {
        taxForm.data = { ...taxForm.data, ...updates.data };
        
        // Recalculate totals if income or deductions changed
        if (updates.data.income || updates.data.deductions) {
          this.calculateTotals(taxForm);
        }
      }

      if (updates.status) {
        taxForm.status = updates.status as 'draft' | 'in_progress' | 'review' | 'completed' | 'filed' | 'amended';
      }

      if (updates.metadata) {
        taxForm.metadata = { ...taxForm.metadata, ...updates.metadata };
      }

      // Increment version and add revision
      taxForm.metadata.version += 1;
      taxForm.metadata.revisionHistory.push(revision);

      // Validate form after updates
      await this.validateTaxForm(taxForm);

      await taxForm.save();

      logger.info('Tax form updated', {
        formId,
        version: taxForm.metadata.version,
        updates: Object.keys(updates),
      });

      return taxForm;
    } catch (error) {
      logger.error('Failed to update tax form', { error, formId });
      throw error;
    }
  }

  /**
   * Calculate tax form totals
   */
  private calculateTotals(taxForm: ITaxFormDocument): void {
    const { income, deductions, credits } = taxForm.data;

    // Calculate total income
    income.totalIncome = 
      income.wages +
      income.interest +
      income.dividends +
      income.businessIncome +
      income.capitalGains +
      income.otherIncome;

    // Calculate total itemized deductions
    if (deductions.itemizedDeductions) {
      deductions.itemizedDeductions.total =
        deductions.itemizedDeductions.stateAndLocalTaxes +
        deductions.itemizedDeductions.mortgageInterest +
        deductions.itemizedDeductions.charitableContributions +
        deductions.itemizedDeductions.medicalExpenses +
        deductions.itemizedDeductions.otherDeductions;
    }

    // Use higher of standard or itemized deductions
    deductions.totalDeductions = Math.max(
      deductions.standardDeduction,
      deductions.itemizedDeductions?.total || 0
    );

    // Calculate total credits
    credits.totalCredits =
      credits.childTaxCredit +
      credits.earnedIncomeCredit +
      credits.educationCredits +
      credits.otherCredits;

    // Calculate tax liability
    const adjustedGrossIncome = income.totalIncome;
    const taxableIncome = Math.max(0, adjustedGrossIncome - deductions.totalDeductions);
    
    // Simplified tax calculation (would need actual tax tables)
    let taxLiability = 0;
    if (taxableIncome > 0) {
      if (taxableIncome <= 10000) {
        taxLiability = taxableIncome * 0.10;
      } else if (taxableIncome <= 40000) {
        taxLiability = 1000 + (taxableIncome - 10000) * 0.12;
      } else if (taxableIncome <= 85000) {
        taxLiability = 4600 + (taxableIncome - 40000) * 0.22;
      } else {
        taxLiability = 14500 + (taxableIncome - 85000) * 0.24;
      }
    }

    // Apply credits
    taxLiability = Math.max(0, taxLiability - credits.totalCredits);

    // Update calculations
    taxForm.data.calculations = {
      adjustedGrossIncome,
      taxableIncome,
      taxLiability,
      totalPayments: taxForm.data.calculations?.totalPayments || 0,
      refundOrAmountDue: (taxForm.data.calculations?.totalPayments || 0) - taxLiability,
    };
  }

  /**
   * Validate tax form
   */
  async validateTaxForm(taxForm: ITaxFormDocument): Promise<void> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate personal info
    if (!taxForm.data.personalInfo.firstName) {
      errors.push('First name is required');
    }

    if (!taxForm.data.personalInfo.lastName) {
      errors.push('Last name is required');
    }

    if (!taxForm.data.personalInfo.ssn) {
      errors.push('SSN is required');
    } else if (!/^\d{3}-\d{2}-\d{4}$/.test(taxForm.data.personalInfo.ssn)) {
      errors.push('SSN must be in format XXX-XX-XXXX');
    }

    // Validate income
    if (taxForm.data.income.totalIncome < 0) {
      errors.push('Total income cannot be negative');
    }

    if (taxForm.data.income.wages < 0) {
      errors.push('Wages cannot be negative');
    }

    // Validate deductions
    if (taxForm.data.deductions.totalDeductions < 0) {
      errors.push('Total deductions cannot be negative');
    }

    // Business logic warnings
    if (taxForm.data.income.totalIncome > 1000000) {
      warnings.push('High income may require additional forms');
    }

    if (taxForm.data.deductions.itemizedDeductions?.charitableContributions > taxForm.data.income.totalIncome * 0.5) {
      warnings.push('Charitable contributions seem unusually high');
    }

    // Update validation
    taxForm.validation = {
      errors,
      warnings,
      isValid: errors.length === 0,
    };
  }

  /**
   * Calculate taxes using AI
   */
  async calculateTaxesWithAI(formId: string): Promise<ITaxFormDocument | null> {
    try {
      const taxForm = await this.getTaxForm(formId);
      
      if (!taxForm) {
        return null;
      }

      // Create job for AI tax calculation
      const job = await jobService.createJob(
        taxForm.sessionId,
        'tax_calculation',
        {
          formId,
          formData: taxForm.data,
          taxYear: taxForm.taxYear,
          filingStatus: taxForm.filingStatus,
        },
        {
          priority: 'high',
          tags: ['ai-calculation', 'tax-form'],
        }
      );

      logger.info('AI tax calculation job created', {
        formId,
        jobId: job.jobId,
      });

      return taxForm;
    } catch (error) {
      logger.error('Failed to calculate taxes with AI', { error, formId });
      throw error;
    }
  }

  /**
   * Generate tax form suggestions
   */
  async generateFormSuggestions(
    sessionId: string,
    userInfo: any
  ): Promise<{
    suggestedForms: string[];
    reasons: Record<string, string>;
    confidence: number;
  }> {
    try {
      const suggestions = await openaiService.suggestTaxForms(userInfo);

      logger.info('Tax form suggestions generated', {
        sessionId,
        suggestedForms: suggestions.recommendedForms,
      });

      return {
        suggestedForms: suggestions.recommendedForms,
        reasons: suggestions.reasoning ? { general: suggestions.reasoning } : {},
        confidence: 0.8, // Default confidence since it's not provided
      };
    } catch (error) {
      logger.error('Failed to generate form suggestions', { error, sessionId });
      throw error;
    }
  }

  /**
   * Validate tax calculations
   */
  async validateTaxCalculations(formId: string): Promise<{
    isValid: boolean;
    errors: string[];
    suggestions: string[];
    confidence: number;
  }> {
    try {
      const taxForm = await this.getTaxForm(formId);
      
      if (!taxForm) {
        throw new Error('Tax form not found');
      }

      const validation = await openaiService.validateTaxCalculations(
        taxForm.data,
        taxForm.data.calculations || {}
      );

      logger.info('Tax calculations validated', {
        formId,
        isValid: validation.isValid,
        errorsCount: validation.errors.length,
      });

      return {
        isValid: validation.isValid,
        errors: validation.errors,
        suggestions: validation.suggestions,
        confidence: 0.8, // Default confidence since it's not provided by OpenAI service
      };
    } catch (error) {
      logger.error('Failed to validate tax calculations', { error, formId });
      throw error;
    }
  }

  /**
   * Delete tax form
   */
  async deleteTaxForm(formId: string): Promise<boolean> {
    try {
      const result = await TaxForm.deleteOne({ formId });

      if (result.deletedCount > 0) {
        logger.info('Tax form deleted', { formId });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to delete tax form', { error, formId });
      throw error;
    }
  }

  /**
   * Get tax form statistics
   */
  async getTaxFormStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    byYear: Record<number, number>;
    completionRate: number;
  }> {
    try {
      const [
        total,
        typeStats,
        statusStats,
        yearStats,
        completedCount,
      ] = await Promise.all([
        TaxForm.countDocuments(),
        TaxForm.aggregate([
          { $group: { _id: '$formType', count: { $sum: 1 } } },
        ]),
        TaxForm.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        TaxForm.aggregate([
          { $group: { _id: '$taxYear', count: { $sum: 1 } } },
        ]),
        TaxForm.countDocuments({ status: 'completed' }),
      ]);

      const byType: Record<string, number> = {};
      typeStats.forEach((stat: any) => {
        byType[stat._id] = stat.count;
      });

      const byStatus: Record<string, number> = {};
      statusStats.forEach((stat: any) => {
        byStatus[stat._id] = stat.count;
      });

      const byYear: Record<number, number> = {};
      yearStats.forEach((stat: any) => {
        byYear[stat._id] = stat.count;
      });

      const completionRate = total > 0 ? (completedCount / total) * 100 : 0;

      return {
        total,
        byType,
        byStatus,
        byYear,
        completionRate,
      };
    } catch (error) {
      logger.error('Failed to get tax form statistics', { error });
      throw error;
    }
  }

  /**
   * Export tax form data
   */
  async exportTaxForm(
    formId: string,
    format: 'json' | 'pdf' | 'xml' = 'json'
  ): Promise<{
    data: any;
    filename: string;
    mimeType: string;
  }> {
    try {
      const taxForm = await this.getTaxForm(formId);
      
      if (!taxForm) {
        throw new Error('Tax form not found');
      }

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `tax_form_${formId}_${timestamp}`;

      switch (format) {
        case 'json':
          return {
            data: JSON.stringify(taxForm.toObject(), null, 2),
            filename: `${filename}.json`,
            mimeType: 'application/json',
          };
        
        case 'xml':
          // TODO: Implement XML export
          throw new Error('XML export not implemented');
        
        case 'pdf':
          // TODO: Implement PDF export
          throw new Error('PDF export not implemented');
        
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      logger.error('Failed to export tax form', { error, formId, format });
      throw error;
    }
  }

  /**
   * Import tax form data
   */
  async importTaxForm(
    sessionId: string,
    data: any,
    format: 'json' | 'xml' = 'json'
  ): Promise<ITaxFormDocument> {
    try {
      let formData: any;

      switch (format) {
        case 'json':
          formData = typeof data === 'string' ? JSON.parse(data) : data;
          break;
        
        case 'xml':
          // TODO: Implement XML import
          throw new Error('XML import not implemented');
        
        default:
          throw new Error(`Unsupported import format: ${format}`);
      }

      // Create new tax form with imported data
      const taxForm = await this.createTaxForm(
        sessionId,
        formData.formType || '1040',
        formData.taxYear || new Date().getFullYear(),
        formData.filingStatus || 'single',
        formData.data,
        formData.metadata
      );

      logger.info('Tax form imported', {
        formId: taxForm.formId,
        sessionId,
        format,
      });

      return taxForm;
    } catch (error) {
      logger.error('Failed to import tax form', { error, sessionId, format });
      throw error;
    }
  }
}

// Export singleton instance
export const taxFormService = TaxFormService.getInstance();