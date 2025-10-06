import mongoose, { Schema, Document, Model } from 'mongoose';
import { ITaxForm } from '../types';

export interface ITaxFormDocument extends ITaxForm, Document {}

export interface ITaxFormModel extends Model<ITaxFormDocument> {
  findByFormId(formId: string): Promise<ITaxFormDocument | null>;
  findBySessionId(sessionId: string): Promise<ITaxFormDocument[]>;
  findByTaxYear(taxYear: number): Promise<ITaxFormDocument[]>;
  findByStatus(status: string): Promise<ITaxFormDocument[]>;
  findBySSN(ssn: string): Promise<ITaxFormDocument[]>;
  findRequiringReview(): Promise<ITaxFormDocument[]>;
  getFormStats(): Promise<any[]>;
}

const TaxFormSchema: Schema = new Schema({
  formId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  sessionId: {
    type: String,
    required: true,
    index: true,
  },
  formType: {
    type: String,
    required: true,
    enum: [
      '1040', '1040EZ', '1040A', '1040NR',
      '1120', '1120S', '1065', '990',
      'Schedule A', 'Schedule B', 'Schedule C', 'Schedule D', 'Schedule E',
      'Schedule F', 'Schedule H', 'Schedule J', 'Schedule K-1', 'Schedule R',
      'Schedule SE', 'Form W-2', 'Form 1099-MISC', 'Form 1099-INT',
      'Form 1099-DIV', 'Form 1099-R', 'Form 8829', 'Form 4562',
      'other'
    ],
  },
  taxYear: {
    type: Number,
    required: true,
    min: 2020,
    max: 2024,
  },
  filingStatus: {
    type: String,
    enum: [
      'single',
      'married_filing_jointly',
      'married_filing_separately',
      'head_of_household',
      'qualifying_widow'
    ],
  },
  status: {
    type: String,
    enum: ['draft', 'in_progress', 'review', 'completed', 'filed', 'amended'],
    default: 'draft',
    index: true,
  },
  data: {
    personalInfo: {
      taxpayer: {
        firstName: String,
        lastName: String,
        ssn: String,
        dateOfBirth: Date,
        occupation: String,
        phone: String,
        email: String,
      },
      spouse: {
        firstName: String,
        lastName: String,
        ssn: String,
        dateOfBirth: Date,
        occupation: String,
      },
      address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: {
          type: String,
          default: 'US',
        },
      },
      dependents: [{
        firstName: String,
        lastName: String,
        ssn: String,
        dateOfBirth: Date,
        relationship: String,
        qualifyingChild: Boolean,
        qualifyingRelative: Boolean,
        childTaxCredit: Boolean,
        earnedIncomeCredit: Boolean,
      }],
    },
    income: {
      wages: {
        type: Number,
        default: 0,
      },
      salaries: {
        type: Number,
        default: 0,
      },
      tips: {
        type: Number,
        default: 0,
      },
      taxableInterest: {
        type: Number,
        default: 0,
      },
      taxExemptInterest: {
        type: Number,
        default: 0,
      },
      ordinaryDividends: {
        type: Number,
        default: 0,
      },
      qualifiedDividends: {
        type: Number,
        default: 0,
      },
      taxableRefunds: {
        type: Number,
        default: 0,
      },
      alimony: {
        type: Number,
        default: 0,
      },
      businessIncome: {
        type: Number,
        default: 0,
      },
      capitalGains: {
        type: Number,
        default: 0,
      },
      otherGains: {
        type: Number,
        default: 0,
      },
      iraDistributions: {
        type: Number,
        default: 0,
      },
      pensionsAnnuities: {
        type: Number,
        default: 0,
      },
      rentalRealEstate: {
        type: Number,
        default: 0,
      },
      farmIncome: {
        type: Number,
        default: 0,
      },
      unemploymentCompensation: {
        type: Number,
        default: 0,
      },
      socialSecurityBenefits: {
        type: Number,
        default: 0,
      },
      otherIncome: {
        type: Number,
        default: 0,
      },
    },
    deductions: {
      standardDeduction: {
        type: Number,
        default: 0,
      },
      itemizedDeductions: {
        medicalDental: {
          type: Number,
          default: 0,
        },
        stateLocalTaxes: {
          type: Number,
          default: 0,
        },
        realEstateTaxes: {
          type: Number,
          default: 0,
        },
        personalPropertyTaxes: {
          type: Number,
          default: 0,
        },
        mortgageInterest: {
          type: Number,
          default: 0,
        },
        investmentInterest: {
          type: Number,
          default: 0,
        },
        charitableContributions: {
          type: Number,
          default: 0,
        },
        casualtyTheftLosses: {
          type: Number,
          default: 0,
        },
        miscellaneousDeductions: {
          type: Number,
          default: 0,
        },
      },
      businessExpenses: {
        type: Map,
        of: Number,
      },
    },
    credits: {
      childTaxCredit: {
        type: Number,
        default: 0,
      },
      earnedIncomeCredit: {
        type: Number,
        default: 0,
      },
      americanOpportunityCredit: {
        type: Number,
        default: 0,
      },
      lifetimeLearningCredit: {
        type: Number,
        default: 0,
      },
      retirementSavingsCredit: {
        type: Number,
        default: 0,
      },
      childDependentCareCredit: {
        type: Number,
        default: 0,
      },
      residentialEnergyCredit: {
        type: Number,
        default: 0,
      },
      otherCredits: {
        type: Number,
        default: 0,
      },
    },
    calculations: {
      adjustedGrossIncome: {
        type: Number,
        default: 0,
      },
      taxableIncome: {
        type: Number,
        default: 0,
      },
      taxBeforeCredits: {
        type: Number,
        default: 0,
      },
      totalCredits: {
        type: Number,
        default: 0,
      },
      taxAfterCredits: {
        type: Number,
        default: 0,
      },
      otherTaxes: {
        type: Number,
        default: 0,
      },
      totalTax: {
        type: Number,
        default: 0,
      },
      federalWithholding: {
        type: Number,
        default: 0,
      },
      estimatedTaxPayments: {
        type: Number,
        default: 0,
      },
      earnedIncomeCredit: {
        type: Number,
        default: 0,
      },
      excessSocialSecurityWithheld: {
        type: Number,
        default: 0,
      },
      totalPayments: {
        type: Number,
        default: 0,
      },
      refundOwed: {
        type: Number,
        default: 0,
      },
      amountOwed: {
        type: Number,
        default: 0,
      },
    },
    customFields: {
      type: Map,
      of: Schema.Types.Mixed,
    },
  },
  validation: {
    errors: [{
      field: String,
      code: String,
      message: String,
      severity: {
        type: String,
        enum: ['error', 'warning', 'info'],
        default: 'error',
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
    }],
    warnings: [{
      field: String,
      code: String,
      message: String,
      timestamp: {
        type: Date,
        default: Date.now,
      },
    }],
    isValid: {
      type: Boolean,
      default: false,
    },
    lastValidatedAt: Date,
  },
  metadata: {
    createdBy: String,
    lastModifiedBy: String,
    version: {
      type: Number,
      default: 1,
    },
    revisionHistory: [{
      version: Number,
      modifiedBy: String,
      modifiedAt: Date,
      changes: String,
      snapshot: Schema.Types.Mixed,
    }],
    tags: [String],
    notes: String,
    estimatedCompletionTime: Number,
    actualCompletionTime: Number,
    complexity: {
      type: String,
      enum: ['simple', 'moderate', 'complex'],
      default: 'simple',
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
    },
    reviewRequired: {
      type: Boolean,
      default: false,
    },
    reviewedBy: String,
    reviewedAt: Date,
    approvedBy: String,
    approvedAt: Date,
  },
  attachments: [{
    documentId: String,
    filename: String,
    documentType: String,
    relevantFields: [String],
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: Date,
  filedAt: Date,
}, {
  timestamps: true,
  versionKey: false,
});

// Indexes
TaxFormSchema.index({ sessionId: 1, formType: 1 });
TaxFormSchema.index({ taxYear: 1, status: 1 });
TaxFormSchema.index({ 'data.personalInfo.taxpayer.ssn': 1 });
TaxFormSchema.index({ 'validation.isValid': 1 });

// Middleware
TaxFormSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Auto-increment version on changes
  if (this.isModified() && !this.isNew) {
    (this.metadata as any).version += 1;
  }
  
  // Set completion timestamp
  if (this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  // Set filed timestamp
  if (this.status === 'filed' && !this.filedAt) {
    this.filedAt = new Date();
  }
  
  next();
});

// Instance methods
TaxFormSchema.methods.calculateTotals = function() {
  const income = this.data.income;
  const deductions = this.data.deductions;
  const credits = this.data.credits;
  
  // Calculate total income
  const totalIncome = Object.values(income).reduce((sum: number, value: any) => {
    return sum + (typeof value === 'number' ? value : 0);
  }, 0);
  
  // Calculate AGI (simplified)
  this.data.calculations.adjustedGrossIncome = totalIncome;
  
  // Calculate taxable income
  const standardOrItemized = Math.max(
    deductions.standardDeduction,
    Object.values(deductions.itemizedDeductions).reduce((sum: number, value: any) => {
      return sum + (typeof value === 'number' ? value : 0);
    }, 0)
  );
  
  this.data.calculations.taxableIncome = Math.max(0, 
    this.data.calculations.adjustedGrossIncome - standardOrItemized
  );
  
  // Calculate total credits
  this.data.calculations.totalCredits = Object.values(credits).reduce((sum: number, value: any) => {
    return sum + (typeof value === 'number' ? value : 0);
  }, 0);
  
  // Calculate refund or amount owed
  const totalPayments = this.data.calculations.totalPayments;
  const totalTax = this.data.calculations.totalTax;
  
  if (totalPayments > totalTax) {
    this.data.calculations.refundOwed = totalPayments - totalTax;
    this.data.calculations.amountOwed = 0;
  } else {
    this.data.calculations.amountOwed = totalTax - totalPayments;
    this.data.calculations.refundOwed = 0;
  }
  
  this.updatedAt = new Date();
};

TaxFormSchema.methods.validate = function() {
  const errors: any[] = [];
  const warnings: any[] = [];
  
  // Required field validations
  if (!this.data.personalInfo.taxpayer.firstName) {
    errors.push({
      field: 'personalInfo.taxpayer.firstName',
      code: 'REQUIRED_FIELD',
      message: 'Taxpayer first name is required',
      severity: 'error',
      timestamp: new Date(),
    });
  }
  
  if (!this.data.personalInfo.taxpayer.lastName) {
    errors.push({
      field: 'personalInfo.taxpayer.lastName',
      code: 'REQUIRED_FIELD',
      message: 'Taxpayer last name is required',
      severity: 'error',
      timestamp: new Date(),
    });
  }
  
  if (!this.data.personalInfo.taxpayer.ssn) {
    errors.push({
      field: 'personalInfo.taxpayer.ssn',
      code: 'REQUIRED_FIELD',
      message: 'Taxpayer SSN is required',
      severity: 'error',
      timestamp: new Date(),
    });
  } else if (!/^\d{3}-?\d{2}-?\d{4}$/.test(this.data.personalInfo.taxpayer.ssn)) {
    errors.push({
      field: 'personalInfo.taxpayer.ssn',
      code: 'INVALID_FORMAT',
      message: 'SSN must be in format XXX-XX-XXXX',
      severity: 'error',
      timestamp: new Date(),
    });
  }
  
  // Income validations
  if (this.data.calculations.adjustedGrossIncome < 0) {
    warnings.push({
      field: 'calculations.adjustedGrossIncome',
      code: 'NEGATIVE_AGI',
      message: 'Adjusted Gross Income is negative',
      timestamp: new Date(),
    });
  }
  
  // Deduction validations
  if (this.filingStatus === 'married_filing_separately' && 
      this.data.deductions.itemizedDeductions.stateLocalTaxes > 5000) {
    warnings.push({
      field: 'deductions.itemizedDeductions.stateLocalTaxes',
      code: 'SALT_LIMIT',
      message: 'SALT deduction limited to $5,000 for MFS',
      timestamp: new Date(),
    });
  }
  
  this.validation.errors = errors;
  this.validation.warnings = warnings;
  this.validation.isValid = errors.length === 0;
  this.validation.lastValidatedAt = new Date();
  
  return {
    isValid: this.validation.isValid,
    errors,
    warnings,
  };
};

TaxFormSchema.methods.addRevision = function(modifiedBy: string, changes: string) {
  this.metadata.revisionHistory.push({
    version: this.metadata.version,
    modifiedBy,
    modifiedAt: new Date(),
    changes,
    snapshot: this.toObject(),
  });
  
  this.metadata.lastModifiedBy = modifiedBy;
  this.updatedAt = new Date();
};

TaxFormSchema.methods.addAttachment = function(documentId: string, filename: string, documentType: string, relevantFields: string[] = []) {
  this.attachments.push({
    documentId,
    filename,
    documentType,
    relevantFields,
    uploadedAt: new Date(),
  });
  
  this.updatedAt = new Date();
};

TaxFormSchema.methods.removeAttachment = function(documentId: string) {
  this.attachments = this.attachments.filter((att: any) => att.documentId !== documentId);
  this.updatedAt = new Date();
};

TaxFormSchema.methods.updateStatus = function(status: string, updatedBy?: string) {
  this.status = status;
  
  if (updatedBy) {
    this.metadata.lastModifiedBy = updatedBy;
  }
  
  if (status === 'completed') {
    this.completedAt = new Date();
  } else if (status === 'filed') {
    this.filedAt = new Date();
  }
  
  this.updatedAt = new Date();
};

TaxFormSchema.methods.requiresReview = function(): boolean {
  return this.metadata.reviewRequired || 
         this.validation.errors.length > 0 ||
         this.data.calculations.adjustedGrossIncome > 100000 ||
         this.metadata.complexity === 'complex';
};

TaxFormSchema.methods.getCompletionPercentage = function(): number {
  const requiredFields = [
    'data.personalInfo.taxpayer.firstName',
    'data.personalInfo.taxpayer.lastName',
    'data.personalInfo.taxpayer.ssn',
    'data.personalInfo.address.street',
    'data.personalInfo.address.city',
    'data.personalInfo.address.state',
    'data.personalInfo.address.zipCode',
  ];
  
  let completedFields = 0;
  
  requiredFields.forEach(field => {
    const value = field.split('.').reduce((obj, key) => obj?.[key], this);
    if (value) completedFields++;
  });
  
  return Math.round((completedFields / requiredFields.length) * 100);
};

// Static methods
TaxFormSchema.statics.findByFormId = function(formId: string) {
  return this.findOne({ formId });
};

TaxFormSchema.statics.findBySessionId = function(sessionId: string) {
  return this.find({ sessionId }).sort({ createdAt: -1 });
};

TaxFormSchema.statics.findByTaxYear = function(taxYear: number) {
  return this.find({ taxYear }).sort({ createdAt: -1 });
};

TaxFormSchema.statics.findByStatus = function(status: string) {
  return this.find({ status }).sort({ updatedAt: -1 });
};

TaxFormSchema.statics.findBySSN = function(ssn: string) {
  return this.find({ 'data.personalInfo.taxpayer.ssn': ssn }).sort({ taxYear: -1 });
};

TaxFormSchema.statics.findRequiringReview = function() {
  return this.find({
    $or: [
      { 'metadata.reviewRequired': true },
      { 'validation.errors.0': { $exists: true } },
      { 'data.calculations.adjustedGrossIncome': { $gt: 100000 } },
      { 'metadata.complexity': 'complex' }
    ]
  }).sort({ updatedAt: -1 });
};

TaxFormSchema.statics.getFormStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: {
          taxYear: '$taxYear',
          status: '$status'
        },
        count: { $sum: 1 },
        avgAGI: { $avg: '$data.calculations.adjustedGrossIncome' },
        avgRefund: { $avg: '$data.calculations.refundOwed' },
        avgOwed: { $avg: '$data.calculations.amountOwed' }
      }
    },
    { $sort: { '_id.taxYear': -1, '_id.status': 1 } }
  ]);
};

export default mongoose.model<ITaxFormDocument, ITaxFormModel>('TaxForm', TaxFormSchema);