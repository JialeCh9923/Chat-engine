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
 * @swagger
 * /api/tax-forms/{sessionId}:
 *   post:
 *     summary: Create a new tax form
 *     description: Create a new tax form for a specific session. Requires API key authentication and is subject to rate limiting.
 *     tags: [Tax Forms]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-zA-Z0-9_-]+$'
 *         description: Session identifier
 *         example: "session_1234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - formType
 *               - taxYear
 *             properties:
 *               formType:
 *                 type: string
 *                 description: Type of tax form
 *                 example: "1040"
 *                 enum: ["1040", "1040EZ", "1040A", "W2", "1099", "1098", "Schedule A", "Schedule B", "Schedule C", "Schedule D", "Schedule E", "Other"]
 *               taxYear:
 *                 type: integer
 *                 description: Tax year for the form
 *                 example: 2024
 *                 minimum: 2020
 *                 maximum: 2030
 *               taxpayerId:
 *                 type: string
 *                 description: Taxpayer identifier
 *                 example: "taxpayer_1234567890"
 *               spouseId:
 *                 type: string
 *                 description: Spouse identifier (if applicable)
 *                 example: "spouse_0987654321"
 *               filingStatus:
 *                 type: string
 *                 description: Filing status
 *                 example: "single"
 *                 enum: ["single", "married_filing_jointly", "married_filing_separately", "head_of_household", "qualifying_widow"]
 *               isJointReturn:
 *                 type: boolean
 *                 description: Whether this is a joint return
 *                 example: false
 *               initialData:
 *                 type: object
 *                 description: Initial form data
 *                 example: { "wages": 75000, "interestIncome": 500 }
 *               metadata:
 *                 type: object
 *                 description: Additional metadata
 *                 example: { "source": "manual_entry", "preparer": "John Doe" }
 *     responses:
 *       201:
 *         description: Tax form created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     formId:
 *                       type: string
 *                       description: Form identifier
 *                       example: "form_1234567890"
 *                     sessionId:
 *                       type: string
 *                       description: Session identifier
 *                       example: "session_1234567890"
 *                     formType:
 *                       type: string
 *                       description: Type of tax form
 *                       example: "1040"
 *                     taxYear:
 *                       type: integer
 *                       description: Tax year
 *                       example: 2024
 *                     status:
 *                       type: string
 *                       enum: [draft, in_progress, completed, filed, error]
 *                       description: Form status
 *                       example: "draft"
 *                     taxpayerId:
 *                       type: string
 *                       description: Taxpayer identifier
 *                       example: "taxpayer_1234567890"
 *                     filingStatus:
 *                       type: string
 *                       description: Filing status
 *                       example: "single"
 *                     isJointReturn:
 *                       type: boolean
 *                       description: Whether this is a joint return
 *                       example: false
 *                     data:
 *                       type: object
 *                       description: Form data
 *                       example: { "wages": 75000, "interestIncome": 500 }
 *                     calculations:
 *                       type: object
 *                       description: Calculated values
 *                       example: { "totalIncome": 75500, "taxableIncome": 65000 }
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       description: Creation timestamp
 *                       example: "2024-01-15T10:30:00Z"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Last update timestamp
 *                       example: "2024-01-15T10:30:00Z"
 *                     metadata:
 *                       type: object
 *                       description: Form metadata
 *                       example: { "source": "manual_entry", "preparer": "John Doe" }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         description: Too many requests (rate limit exceeded)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: "RATE_LIMIT_EXCEEDED"
 *                 message: "Too many requests, please try again later"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
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
 * @swagger
 * /api/tax-forms/{formId}:
 *   get:
 *     summary: Get tax form by ID
 *     description: Retrieve a specific tax form by its ID. Requires API key authentication.
 *     tags: [Tax Forms]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: formId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^form_[a-zA-Z0-9_-]+$'
 *         description: Tax form identifier
 *         example: "form_1234567890"
 *     responses:
 *       200:
 *         description: Tax form retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     formId:
 *                       type: string
 *                       description: Form identifier
 *                       example: "form_1234567890"
 *                     sessionId:
 *                       type: string
 *                       description: Session identifier
 *                       example: "session_1234567890"
 *                     formType:
 *                       type: string
 *                       description: Type of tax form
 *                       example: "1040"
 *                     taxYear:
 *                       type: integer
 *                       description: Tax year
 *                       example: 2024
 *                     status:
 *                       type: string
 *                       enum: [draft, in_progress, completed, filed, error]
 *                       description: Form status
 *                       example: "completed"
 *                     taxpayerId:
 *                       type: string
 *                       description: Taxpayer identifier
 *                       example: "taxpayer_1234567890"
 *                     spouseId:
 *                       type: string
 *                       description: Spouse identifier (if applicable)
 *                       example: "spouse_0987654321"
 *                     filingStatus:
 *                       type: string
 *                       description: Filing status
 *                       example: "single"
 *                     isJointReturn:
 *                       type: boolean
 *                       description: Whether this is a joint return
 *                       example: false
 *                     data:
 *                       type: object
 *                       description: Form data
 *                       properties:
 *                         wages:
 *                           type: number
 *                           description: Wages, salaries, tips
 *                           example: 75000
 *                         interestIncome:
 *                           type: number
 *                           description: Interest income
 *                           example: 500
 *                         dividends:
 *                           type: number
 *                           description: Dividend income
 *                           example: 1200
 *                         businessIncome:
 *                           type: number
 *                           description: Business income
 *                           example: 0
 *                         capitalGains:
 *                           type: number
 *                           description: Capital gains/losses
 *                           example: -500
 *                         adjustments:
 *                           type: number
 *                           description: Adjustments to income
 *                           example: 5000
 *                         deductions:
 *                           type: number
 *                           description: Itemized deductions
 *                           example: 12000
 *                         credits:
 *                           type: object
 *                           description: Tax credits
 *                           properties:
 *                             childTaxCredit:
 *                               type: number
 *                               description: Child tax credit
 *                               example: 2000
 *                             earnedIncomeCredit:
 *                               type: number
 *                               description: Earned income credit
 *                               example: 0
 *                     calculations:
 *                       type: object
 *                       description: Calculated values
 *                       properties:
 *                         totalIncome:
 *                           type: number
 *                           description: Total income
 *                           example: 76200
 *                         adjustedGrossIncome:
 *                           type: number
 *                           description: Adjusted gross income
 *                           example: 71200
 *                         taxableIncome:
 *                           type: number
 *                           description: Taxable income
 *                           example: 59200
 *                         totalTax:
 *                           type: number
 *                           description: Total tax liability
 *                           example: 8900
 *                         totalPayments:
 *                           type: number
 *                           description: Total payments and credits
 *                           example: 9500
 *                         refundOrAmountDue:
 *                           type: number
 *                           description: Refund (positive) or amount due (negative)
 *                           example: 600
 *                     validationErrors:
 *                       type: array
 *                       description: Validation errors (if any)
 *                       items:
 *                         type: object
 *                         properties:
 *                           field:
 *                           type: string
 *                           description: Field with error
 *                           example: "businessIncome"
 *                           message:
 *                             type: string
 *                             description: Error message
 *                             example: "Business income cannot be negative"
 *                           severity:
 *                             type: string
 *                             enum: [warning, error]
 *                             description: Error severity
 *                             example: "error"
 *                     aiSuggestions:
 *                       type: array
 *                       description: AI-generated suggestions
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             description: Suggestion type
 *                             example: "deduction"
 *                           description:
 *                             type: string
 *                             description: Suggestion description
 *                             example: "Consider claiming student loan interest deduction"
 *                           estimatedSavings:
 *                             type: number
 *                             description: Estimated tax savings
 *                             example: 500
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       description: Creation timestamp
 *                       example: "2024-01-15T10:30:00Z"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Last update timestamp
 *                       example: "2024-01-15T11:45:00Z"
 *                     completedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Completion timestamp (if completed)
 *                       example: "2024-01-15T11:45:00Z"
 *                     filedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Filing timestamp (if filed)
 *                       example: "2024-01-20T14:30:00Z"
 *                     metadata:
 *                       type: object
 *                       description: Form metadata
 *                       example: { "source": "manual_entry", "preparer": "John Doe", "lastEditor": "Jane Smith" }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  '/:formId',
  validateFormId,
  handleValidationErrors,
  authHandler(TaxFormController.getTaxForm)
);

/**
 * @swagger
 * /api/tax-forms/session/{sessionId}:
 *   get:
 *     summary: Get tax forms by session
 *     description: Retrieve all tax forms associated with a specific session. Requires API key authentication.
 *     tags: [Tax Forms]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^session_[a-zA-Z0-9_-]+$'
 *         description: Session identifier
 *         example: "session_1234567890"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, in_progress, completed, filed, error]
 *         description: Filter by form status
 *       - in: query
 *         name: formType
 *         schema:
 *           type: string
 *         description: Filter by form type (e.g., "1040", "W2")
 *       - in: query
 *         name: taxYear
 *         schema:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2030
 *         description: Filter by tax year
 *     responses:
 *       200:
 *         description: Tax forms retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     forms:
 *                       type: array
 *                       description: Array of tax forms
 *                       items:
 *                         type: object
 *                         properties:
 *                           formId:
 *                             type: string
 *                             description: Form identifier
 *                             example: "form_1234567890"
 *                           sessionId:
 *                             type: string
 *                             description: Session identifier
 *                             example: "session_1234567890"
 *                           formType:
 *                             type: string
 *                             description: Type of tax form
 *                             example: "1040"
 *                           taxYear:
 *                             type: integer
 *                             description: Tax year
 *                             example: 2024
 *                           status:
 *                             type: string
 *                             enum: [draft, in_progress, completed, filed, error]
 *                             description: Form status
 *                             example: "draft"
 *                           taxpayerId:
 *                             type: string
 *                             description: Taxpayer identifier
 *                             example: "taxpayer_1234567890"
 *                           spouseId:
 *                             type: string
 *                             description: Spouse identifier (if applicable)
 *                             example: "spouse_0987654321"
 *                           filingStatus:
 *                             type: string
 *                             description: Filing status
 *                             example: "married_filing_jointly"
 *                           isJointReturn:
 *                             type: boolean
 *                             description: Whether this is a joint return
 *                             example: true
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             description: Creation timestamp
 *                             example: "2024-01-15T10:30:00Z"
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                             description: Last update timestamp
 *                             example: "2024-01-15T12:00:00Z"
 *                           metadata:
 *                             type: object
 *                             description: Form metadata
 *                     pagination:
 *                       type: object
 *                       description: Pagination information
 *                       properties:
 *                         page:
 *                           type: integer
 *                           description: Current page number
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           description: Items per page
 *                           example: 20
 *                         total:
 *                           type: integer
 *                           description: Total number of forms
 *                           example: 45
 *                         pages:
 *                           type: integer
 *                           description: Total number of pages
 *                           example: 3
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  '/session/:sessionId',
  validateSessionId,
  validatePagination,
  handleValidationErrors,
  authHandler(TaxFormController.getTaxFormsBySession)
);

/**
 * @swagger
 * /api/tax-forms/{formId}:
 *   put:
 *     summary: Update tax form
 *     description: Update an existing tax form with new data. Requires API key authentication.
 *     tags: [Tax Forms]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: formId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^form_[a-zA-Z0-9_-]+$'
 *         description: Tax form identifier
 *         example: "form_1234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *                 description: Updated form data
 *                 properties:
 *                   wages:
 *                     type: number
 *                     description: Wages, salaries, tips
 *                     example: 75000
 *                   interestIncome:
 *                     type: number
 *                     description: Interest income
 *                     example: 500
 *                   dividends:
 *                     type: number
 *                     description: Dividend income
 *                     example: 1200
 *                   businessIncome:
 *                     type: number
 *                     description: Business income
 *                     example: 0
 *                   capitalGains:
 *                     type: number
 *                     description: Capital gains/losses
 *                     example: -500
 *                   adjustments:
 *                     type: number
 *                     description: Adjustments to income
 *                     example: 5000
 *                   deductions:
 *                     type: number
 *                     description: Itemized deductions
 *                     example: 12000
 *                   credits:
 *                     type: object
 *                     description: Tax credits
 *                     properties:
 *                       childTaxCredit:
 *                         type: number
 *                         description: Child tax credit
 *                         example: 2000
 *                       earnedIncomeCredit:
 *                         type: number
 *                         description: Earned income credit
 *                         example: 0
 *               taxpayerId:
 *                 type: string
 *                 description: Updated taxpayer identifier
 *                 example: "taxpayer_1234567890"
 *               spouseId:
 *                 type: string
 *                 description: Updated spouse identifier
 *                 example: "spouse_0987654321"
 *               filingStatus:
 *                 type: string
 *                 enum: [single, married_filing_jointly, married_filing_separately, head_of_household, qualifying_widow]
 *                 description: Updated filing status
 *                 example: "married_filing_jointly"
 *               isJointReturn:
 *                 type: boolean
 *                 description: Updated joint return status
 *                 example: true
 *               metadata:
 *                 type: object
 *                 description: Updated metadata
 *                 example: { "lastEditor": "Jane Smith", "source": "manual_update" }
 *     responses:
 *       200:
 *         description: Tax form updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     formId:
 *                       type: string
 *                       description: Form identifier
 *                       example: "form_1234567890"
 *                     sessionId:
 *                       type: string
 *                       description: Session identifier
 *                       example: "session_1234567890"
 *                     formType:
 *                       type: string
 *                       description: Type of tax form
 *                       example: "1040"
 *                     taxYear:
 *                       type: integer
 *                       description: Tax year
 *                       example: 2024
 *                     status:
 *                       type: string
 *                       enum: [draft, in_progress, completed, filed, error]
 *                       description: Form status
 *                       example: "draft"
 *                     taxpayerId:
 *                       type: string
 *                       description: Taxpayer identifier
 *                       example: "taxpayer_1234567890"
 *                     spouseId:
 *                       type: string
 *                       description: Spouse identifier (if applicable)
 *                       example: "spouse_0987654321"
 *                     filingStatus:
 *                       type: string
 *                       description: Filing status
 *                       example: "married_filing_jointly"
 *                     isJointReturn:
 *                       type: boolean
 *                       description: Whether this is a joint return
 *                       example: true
 *                     data:
 *                       type: object
 *                       description: Updated form data
 *                     calculations:
 *                       type: object
 *                       description: Calculated values
 *                     validationErrors:
 *                       type: array
 *                       description: Validation errors (if any)
 *                     aiSuggestions:
 *                       type: array
 *                       description: AI-generated suggestions
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       description: Creation timestamp
 *                       example: "2024-01-15T10:30:00Z"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Last update timestamp
 *                       example: "2024-01-15T12:00:00Z"
 *                     metadata:
 *                       type: object
 *                       description: Form metadata
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  '/:formId',
  validateFormId,
  validateUpdateTaxForm,
  handleValidationErrors,
  authHandler(TaxFormController.updateTaxForm)
);

/**
 * @swagger
 * /api/tax-forms/{formId}:
 *   delete:
 *     summary: Delete tax form
 *     description: Delete a tax form by its ID. Requires API key authentication.
 *     tags: [Tax Forms]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: formId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^form_[a-zA-Z0-9_-]+$'
 *         description: Tax form identifier
 *         example: "form_1234567890"
 *     responses:
 *       200:
 *         description: Tax form deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Tax form deleted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     formId:
 *                       type: string
 *                       description: Deleted form identifier
 *                       example: "form_1234567890"
 *                     deletedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Deletion timestamp
 *                       example: "2024-01-15T12:00:00Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete(
  '/:formId',
  validateFormId,
  handleValidationErrors,
  authHandler(TaxFormController.deleteTaxForm)
);

/**
 * @swagger
 * /api/tax-forms/{formId}/calculate:
 *   post:
 *     summary: Calculate tax form
 *     description: Calculate tax liability and other values for a tax form. Requires API key authentication.
 *     tags: [Tax Forms]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: formId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^form_[a-zA-Z0-9_-]+$'
 *         description: Tax form identifier
 *         example: "form_1234567890"
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               recalculate:
 *                 type: boolean
 *                 description: Force recalculation even if already calculated
 *                 example: true
 *               validate:
 *                 type: boolean
 *                 description: Perform validation during calculation
 *                 example: true
 *               options:
 *                 type: object
 *                 description: Calculation options
 *                 properties:
 *                   method:
 *                     type: string
 *                     enum: [standard, itemized, both]
 *                     description: Deduction method to use
 *                     example: "standard"
 *                   precision:
 *                     type: integer
 *                     description: Decimal precision for calculations
 *                     example: 2
 *                   includeState:
 *                     type: boolean
 *                     description: Include state tax calculations
 *                     example: false
 *     responses:
 *       200:
 *         description: Tax form calculated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     formId:
 *                       type: string
 *                       description: Form identifier
 *                       example: "form_1234567890"
 *                     calculations:
 *                       type: object
 *                       description: Calculated values
 *                       properties:
 *                         totalIncome:
 *                           type: number
 *                           description: Total income
 *                           example: 76200
 *                         adjustedGrossIncome:
 *                           type: number
 *                           description: Adjusted gross income
 *                           example: 71200
 *                         taxableIncome:
 *                           type: number
 *                           description: Taxable income
 *                           example: 59200
 *                         totalTax:
 *                           type: number
 *                           description: Total tax liability
 *                           example: 8900
 *                         totalPayments:
 *                           type: number
 *                           description: Total payments and credits
 *                           example: 9500
 *                         refundOrAmountDue:
 *                           type: number
 *                           description: Refund (positive) or amount due (negative)
 *                           example: 600
 *                         effectiveTaxRate:
 *                           type: number
 *                           description: Effective tax rate
 *                           example: 0.117
 *                         marginalTaxRate:
 *                           type: number
 *                           description: Marginal tax rate
 *                           example: 0.22
 *                         federalTax:
 *                           type: number
 *                           description: Federal tax amount
 *                           example: 8900
 *                         stateTax:
 *                           type: number
 *                           description: State tax amount (if calculated)
 *                           example: 0
 *                         selfEmploymentTax:
 *                           type: number
 *                           description: Self-employment tax
 *                           example: 0
 *                         alternativeMinimumTax:
 *                           type: number
 *                           description: Alternative minimum tax
 *                           example: 0
 *                     validationErrors:
 *                       type: array
 *                       description: Validation errors found during calculation
 *                       items:
 *                         type: object
 *                         properties:
 *                           field:
 *                             type: string
 *                             description: Field with error
 *                             example: "businessIncome"
 *                           message:
 *                             type: string
 *                             description: Error message
 *                             example: "Business income cannot be negative"
 *                           severity:
 *                             type: string
 *                             enum: [warning, error]
 *                             description: Error severity
 *                             example: "error"
 *                     aiSuggestions:
 *                       type: array
 *                       description: AI-generated suggestions based on calculation
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             description: Suggestion type
 *                             example: "deduction"
 *                           description:
 *                             type: string
 *                             description: Suggestion description
 *                             example: "Consider claiming student loan interest deduction"
 *                           estimatedSavings:
 *                             type: number
 *                             description: Estimated tax savings
 *                             example: 500
 *                           confidence:
 *                             type: number
 *                             description: Confidence level (0-1)
 *                             example: 0.85
 *                     calculationTimestamp:
 *                       type: string
 *                       format: date-time
 *                       description: Calculation timestamp
 *                       example: "2024-01-15T12:00:00Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  '/:formId/calculate',
  sensitiveOperationRateLimiter,
  validateFormId,
  handleValidationErrors,
  authHandler(TaxFormController.calculateTaxForm)
);

/**
 * @swagger
 * /api/tax-forms/session/{sessionId}/suggestions:
 *   post:
 *     summary: Generate tax form suggestions
 *     description: Generate AI-powered suggestions for tax forms based on session data. Requires API key authentication.
 *     tags: [Tax Forms]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^session_[a-zA-Z0-9_-]+$'
 *         description: Session identifier
 *         example: "session_1234567890"
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               formType:
 *                 type: string
 *                 description: Target form type for suggestions
 *                 example: "1040"
 *               taxYear:
 *                 type: integer
 *                 description: Tax year for suggestions
 *                 example: 2024
 *               context:
 *                 type: object
 *                 description: Additional context for AI suggestions
 *                 properties:
 *                   incomeLevel:
 *                     type: string
 *                     enum: [low, medium, high]
 *                     description: Income level category
 *                     example: "medium"
 *                   familyStatus:
 *                     type: string
 *                     enum: [single, married, divorced, widowed]
 *                     description: Family status
 *                     example: "married"
 *                   hasDependents:
 *                     type: boolean
 *                     description: Whether taxpayer has dependents
 *                     example: true
 *                   employmentType:
 *                     type: string
 *                     enum: [employee, self_employed, business_owner, retired, unemployed]
 *                     description: Employment type
 *                     example: "employee"
 *                   priorFilingStatus:
 *                     type: string
 *                     description: Previous year's filing status
 *                     example: "married_filing_jointly"
 *               options:
 *                 type: object
 *                 description: Suggestion options
 *                 properties:
 *                   maxSuggestions:
 *                     type: integer
 *                     description: Maximum number of suggestions to return
 *                     example: 10
 *                   categories:
 *                     type: array
 *                     description: Categories of suggestions to include
 *                     items:
 *                       type: string
 *                       enum: [deductions, credits, filing_status, compliance, optimization]
 *                     example: ["deductions", "credits"]
 *                   confidenceThreshold:
 *                     type: number
 *                     description: Minimum confidence level (0-1)
 *                     example: 0.7
 *     responses:
 *       200:
 *         description: Suggestions generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     sessionId:
 *                       type: string
 *                       description: Session identifier
 *                       example: "session_1234567890"
 *                     suggestions:
 *                       type: array
 *                       description: AI-generated suggestions
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: Suggestion identifier
 *                             example: "suggestion_1234567890"
 *                           type:
 *                             type: string
 *                             enum: [deduction, credit, filing_status, compliance, optimization]
 *                             description: Suggestion type
 *                             example: "deduction"
 *                           title:
 *                             type: string
 *                             description: Suggestion title
 *                             example: "Consider Student Loan Interest Deduction"
 *                           description:
 *                             type: string
 *                             description: Detailed description
 *                             example: "You may be eligible to deduct up to $2,500 of student loan interest paid during the tax year."
 *                           category:
 *                             type: string
 *                             description: Suggestion category
 *                             example: "education"
 *                           estimatedImpact:
 *                             type: object
 *                             description: Estimated tax impact
 *                             properties:
 *                               type:
 *                                 type: string
 *                                 enum: [savings, refund_increase, tax_reduction]
 *                                 description: Impact type
 *                                 example: "savings"
 *                               amount:
 *                                 type: number
 *                                 description: Estimated dollar amount
 *                                 example: 2500
 *                               range:
 *                                 type: object
 *                                 description: Impact range
 *                                 properties:
 *                                   min:
 *                                     type: number
 *                                     description: Minimum estimated impact
 *                                     example: 2000
 *                                   max:
 *                                     type: number
 *                                     description: Maximum estimated impact
 *                                     example: 2500
 *                           requirements:
 *                             type: array
 *                             description: Requirements to qualify
 *                             items:
 *                               type: string
 *                             example: ["Paid student loan interest", "Income below $85,000 (single) or $170,000 (married filing jointly)"]
 *                           actionItems:
 *                             type: array
 *                             description: Recommended actions
 *                             items:
 *                               type: string
 *                             example: ["Gather Form 1098-E from your loan servicer", "Calculate total interest paid"]
 *                           confidence:
 *                             type: number
 *                             description: AI confidence level (0-1)
 *                             example: 0.85
 *                           priority:
 *                             type: string
 *                             enum: [high, medium, low]
 *                             description: Suggestion priority
 *                             example: "high"
 *                           applicableFormTypes:
 *                             type: array
 *                             description: Form types this applies to
 *                             items:
 *                               type: string
 *                             example: ["1040", "1040A", "1040EZ"]
 *                           taxYear:
 *                             type: integer
 *                             description: Tax year relevance
 *                             example: 2024
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             description: Suggestion creation timestamp
 *                             example: "2024-01-15T12:00:00Z"
 *                     metadata:
 *                       type: object
 *                       description: Suggestion metadata
 *                       properties:
 *                         totalSuggestions:
 *                           type: integer
 *                           description: Total number of suggestions
 *                           example: 8
 *                         highPriority:
 *                           type: integer
 *                           description: Number of high priority suggestions
 *                           example: 3
 *                         mediumPriority:
 *                           type: integer
 *                           description: Number of medium priority suggestions
 *                           example: 3
 *                         lowPriority:
 *                           type: integer
 *                           description: Number of low priority suggestions
 *                           example: 2
 *                         categories:
 *                           type: object
 *                           description: Suggestions by category
 *                           additionalProperties:
 *                             type: integer
 *                           example: { "deductions": 4, "credits": 2, "filing_status": 1, "optimization": 1 }
 *                         processingTime:
 *                           type: number
 *                           description: Processing time in milliseconds
 *                           example: 1250
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         description: Too many requests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "RATE_LIMIT_EXCEEDED"
 *                     message:
 *                       type: string
 *                       example: "Too many AI suggestion requests. Please try again later."
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  '/session/:sessionId/suggestions',
  validateSessionId,
  handleValidationErrors,
  authHandler(TaxFormController.generateFormSuggestions)
);

/**
 * @swagger
 * /api/tax-forms/{formId}/validate:
 *   post:
 *     summary: Validate tax form
 *     description: Validate tax form data for completeness and accuracy. Requires API key authentication.
 *     tags: [Tax Forms]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: formId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^form_[a-zA-Z0-9_-]+$'
 *         description: Tax form identifier
 *         example: "form_1234567890"
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               level:
 *                 type: string
 *                 enum: [basic, comprehensive, strict]
 *                 description: Validation level
 *                 example: "comprehensive"
 *               checks:
 *                 type: array
 *                 description: Specific validation checks to perform
 *                 items:
 *                   type: string
 *                   enum: [required_fields, calculations, deductions, credits, compliance, logic]
 *                 example: ["required_fields", "calculations", "deductions"]
 *               options:
 *                 type: object
 *                 description: Validation options
 *                 properties:
 *                   allowWarnings:
 *                     type: boolean
 *                     description: Allow warnings without failing validation
 *                     example: true
 *                   checkDuplicates:
 *                     type: boolean
 *                     description: Check for duplicate entries
 *                     example: false
 *                   crossReference:
 *                     type: boolean
 *                     description: Cross-reference with external data
 *                     example: true
 *     responses:
 *       200:
 *         description: Validation completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     formId:
 *                       type: string
 *                       description: Form identifier
 *                       example: "form_1234567890"
 *                     isValid:
 *                       type: boolean
 *                       description: Overall validation result
 *                       example: false
 *                     level:
 *                       type: string
 *                       description: Validation level used
 *                       example: "comprehensive"
 *                     summary:
 *                       type: object
 *                       description: Validation summary
 *                       properties:
 *                         totalErrors:
 *                           type: integer
 *                           description: Total number of errors
 *                           example: 2
 *                         totalWarnings:
 *                           type: integer
 *                           description: Total number of warnings
 *                           example: 1
 *                         criticalErrors:
 *                           type: integer
 *                           description: Number of critical errors
 *                           example: 1
 *                         checksPerformed:
 *                           type: integer
 *                           description: Number of checks performed
 *                           example: 15
 *                     errors:
 *                       type: array
 *                       description: Validation errors
 *                       items:
 *                         type: object
 *                         properties:
 *                           field:
 *                             type: string
 *                             description: Field with error
 *                             example: "taxpayerId"
 *                           message:
 *                             type: string
 *                             description: Error message
 *                             example: "Taxpayer ID is required"
 *                           severity:
 *                             type: string
 *                             enum: [error, warning]
 *                             description: Error severity
 *                             example: "error"
 *                           code:
 *                             type: string
 *                             description: Error code
 *                             example: "REQUIRED_FIELD_MISSING"
 *                           category:
 *                             type: string
 *                             description: Error category
 *                             example: "required_fields"
 *                     warnings:
 *                       type: array
 *                       description: Validation warnings
 *                       items:
 *                         type: object
 *                         properties:
 *                           field:
 *                             type: string
 *                             description: Field with warning
 *                             example: "deductions"
 *                           message:
 *                             type: string
 *                             description: Warning message
 *                             example: "Standard deduction may be more beneficial"
 *                           severity:
 *                             type: string
 *                             enum: [warning]
 *                             description: Warning severity
 *                             example: "warning"
 *                           code:
 *                             type: string
 *                             description: Warning code
 *                             example: "SUBOPTIMAL_DEDUCTION"
 *                           category:
 *                             type: string
 *                             description: Warning category
 *                             example: "deductions"
 *                     recommendations:
 *                       type: array
 *                       description: Validation recommendations
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             description: Recommendation type
 *                             example: "optimization"
 *                           description:
 *                             type: string
 *                             description: Recommendation description
 *                             example: "Consider itemizing deductions"
 *                           estimatedImpact:
 *                             type: number
 *                             description: Estimated tax impact
 *                             example: -1200
 *                           priority:
 *                             type: string
 *                             enum: [low, medium, high]
 *                             description: Recommendation priority
 *                             example: "medium"
 *                     validationTimestamp:
 *                       type: string
 *                       format: date-time
 *                       description: Validation timestamp
 *                       example: "2024-01-15T12:00:00Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  '/:formId/validate',
  validateFormId,
  handleValidationErrors,
  authHandler(TaxFormController.validateCalculations)
);

/**
 * @swagger
 * /api/tax-forms/{formId}/export:
 *   get:
 *     summary: Export tax form
 *     description: Export tax form data in various formats (PDF, JSON, CSV). Requires API key authentication.
 *     tags: [Tax Forms]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: formId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^form_[a-zA-Z0-9_-]+$'
 *         description: Tax form identifier
 *         example: "form_1234567890"
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [pdf, json, csv, xml]
 *           default: pdf
 *         description: Export format
 *         example: "pdf"
 *       - in: query
 *         name: includeCalculations
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include calculated values in export
 *         example: true
 *       - in: query
 *         name: includeMetadata
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include metadata in export
 *         example: true
 *       - in: query
 *         name: version
 *         schema:
 *           type: string
 *           enum: [current, original, all]
 *           default: current
 *         description: Version to export
 *         example: "current"
 *     responses:
 *       200:
 *         description: Tax form exported successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *             description: PDF file containing the tax form
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 formId:
 *                   type: string
 *                   description: Form identifier
 *                   example: "form_1234567890"
 *                 formType:
 *                   type: string
 *                   description: Type of tax form
 *                   example: "1040"
 *                 taxYear:
 *                   type: integer
 *                   description: Tax year
 *                   example: 2024
 *                 taxpayer:
 *                   type: object
 *                   description: Taxpayer information
 *                   properties:
 *                     taxpayerId:
 *                       type: string
 *                       description: Taxpayer identifier
 *                       example: "taxpayer_1234567890"
 *                     name:
 *                       type: string
 *                       description: Taxpayer name
 *                       example: "John Doe"
 *                     ssn:
 *                       type: string
 *                       description: Social Security Number (masked)
 *                       example: "XXX-XX-1234"
 *                 data:
 *                   type: object
 *                   description: Form data
 *                 calculations:
 *                   type: object
 *                   description: Calculated values
 *                 metadata:
 *                   type: object
 *                   description: Form metadata
 *                 exportTimestamp:
 *                   type: string
 *                   format: date-time
 *                   description: Export timestamp
 *                   example: "2024-01-15T12:00:00Z"
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV file containing tax form data
 *           application/xml:
 *             schema:
 *               type: string
 *               description: XML file containing tax form data
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  '/:formId/export',
  validateFormId,
  validateExportTaxForm,
  handleValidationErrors,
  authHandler(TaxFormController.exportTaxForm)
);

/**
 * @swagger
 * /api/tax-forms/session/{sessionId}/import:
 *   post:
 *     summary: Import tax form for session
 *     description: Import tax form data from uploaded file (PDF, CSV, JSON, XML) for a specific session. Requires API key authentication.
 *     tags: [Tax Forms]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^session_[a-zA-Z0-9_-]+$'
 *         description: Session identifier
 *         example: "session_1234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Tax form file to import (PDF, CSV, JSON, XML)
 *               formType:
 *                 type: string
 *                 description: Tax form type (if not auto-detected)
 *                 example: "1040"
 *               taxYear:
 *                 type: integer
 *                 description: Tax year (if not auto-detected)
 *                 example: 2024
 *               options:
 *                 type: object
 *                 description: Import options
 *                 properties:
 *                   validate:
 *                     type: boolean
 *                     description: Validate imported data
 *                     example: true
 *                   calculate:
 *                     type: boolean
 *                     description: Perform calculations after import
 *                     example: true
 *                   overwrite:
 *                     type: boolean
 *                     description: Overwrite existing data
 *                     example: false
 *                   extractData:
 *                     type: boolean
 *                     description: Extract data from PDF forms
 *                     example: true
 *     responses:
 *       201:
 *         description: Tax form imported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Tax form imported successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     formId:
 *                       type: string
 *                       description: Created form identifier
 *                       example: "form_1234567890"
 *                     sessionId:
 *                       type: string
 *                       description: Session identifier
 *                       example: "session_1234567890"
 *                     formType:
 *                       type: string
 *                       description: Detected form type
 *                       example: "1040"
 *                     taxYear:
 *                       type: integer
 *                       description: Tax year
 *                       example: 2024
 *                     status:
 *                       type: string
 *                       enum: [draft, in_progress, completed, filed, error]
 *                       description: Form status
 *                       example: "draft"
 *                     taxpayerId:
 *                       type: string
 *                       description: Taxpayer identifier
 *                       example: "taxpayer_1234567890"
 *                     data:
 *                       type: object
 *                       description: Imported form data
 *                     calculations:
 *                       type: object
 *                       description: Calculated values (if calculated)
 *                     validationErrors:
 *                       type: array
 *                       description: Validation errors found during import
 *                       items:
 *                         type: object
 *                         properties:
 *                           field:
 *                             type: string
 *                             description: Field with error
 *                             example: "businessIncome"
 *                           message:
 *                             type: string
 *                             description: Error message
 *                             example: "Business income cannot be negative"
 *                           severity:
 *                             type: string
 *                             enum: [warning, error]
 *                             description: Error severity
 *                             example: "error"
 *                     importSummary:
 *                       type: object
 *                       description: Import summary
 *                       properties:
 *                         sourceFormat:
 *                           type: string
 *                           description: Source file format
 *                           example: "pdf"
 *                         fieldsImported:
 *                           type: integer
 *                           description: Number of fields imported
 *                           example: 25
 *                         fieldsSkipped:
 *                           type: integer
 *                           description: Number of fields skipped
 *                           example: 3
 *                         validationIssues:
 *                           type: integer
 *                           description: Number of validation issues
 *                           example: 2
 *                         processingTime:
 *                           type: number
 *                           description: Processing time in milliseconds
 *                           example: 1250
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       description: Creation timestamp
 *                       example: "2024-01-15T10:30:00Z"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Last update timestamp
 *                       example: "2024-01-15T10:30:00Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       413:
 *         description: File too large
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "FILE_TOO_LARGE"
 *                     message:
 *                       type: string
 *                       example: "File size exceeds maximum allowed size of 10MB"
 *       415:
 *         description: Unsupported file format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "UNSUPPORTED_FORMAT"
 *                     message:
 *                       type: string
 *                       example: "File format not supported. Supported formats: PDF, CSV, JSON, XML"
 *       429:
 *         description: Too many requests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "RATE_LIMIT_EXCEEDED"
 *                     message:
 *                       type: string
 *                       example: "Too many import requests. Please try again later."
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  '/session/:sessionId/import',
  sensitiveOperationRateLimiter,
  validateSessionId,
  handleValidationErrors,
  authHandler(TaxFormController.importTaxForm)
);

/**
 * @swagger
 * /api/tax-forms/stats:
 *   get:
 *     summary: Get tax form statistics
 *     description: Retrieve comprehensive statistics about tax forms, including counts by form type, status, and time periods. Requires API key authentication.
 *     tags: [Tax Forms]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for statistics (ISO 8601 format)
 *         example: "2024-01-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for statistics (ISO 8601 format)
 *         example: "2024-12-31"
 *       - in: query
 *         name: formType
 *         schema:
 *           type: string
 *         description: Filter by specific form type (e.g., "1040", "W2", "1099")
 *         example: "1040"
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *         description: Filter by specific session ID
 *         example: "session_1234567890"
 *     responses:
 *       200:
 *         description: Tax form statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalForms:
 *                       type: integer
 *                       description: Total number of tax forms
 *                       example: 1250
 *                     byStatus:
 *                       type: object
 *                       description: Forms grouped by status
 *                       properties:
 *                         draft:
 *                           type: integer
 *                           description: Number of draft forms
 *                           example: 450
 *                         completed:
 *                           type: integer
 *                           description: Number of completed forms
 *                           example: 650
 *                         filed:
 *                           type: integer
 *                           description: Number of filed forms
 *                           example: 120
 *                         error:
 *                           type: integer
 *                           description: Number of forms with errors
 *                           example: 30
 *                     byFormType:
 *                       type: object
 *                       description: Forms grouped by form type
 *                       properties:
 *                         "1040":
 *                           type: integer
 *                           description: Number of Form 1040
 *                           example: 800
 *                         "W2":
 *                           type: integer
 *                           description: Number of W2 forms
 *                           example: 300
 *                         "1099":
 *                           type: integer
 *                           description: Number of 1099 forms
 *                           example: 150
 *                     byTaxYear:
 *                       type: object
 *                       description: Forms grouped by tax year
 *                       properties:
 *                         "2024":
 *                           type: integer
 *                           description: Number of forms for 2024
 *                           example: 1250
 *                         "2023":
 *                           type: integer
 *                           description: Number of forms for 2023
 *                           example: 980
 *                     completionRate:
 *                       type: number
 *                       description: Percentage of completed forms
 *                       example: 0.52
 *                     averageCompletionTime:
 *                       type: number
 *                       description: Average completion time in minutes
 *                       example: 25.5
 *                     recentActivity:
 *                       type: object
 *                       description: Recent activity metrics
 *                       properties:
 *                         last24Hours:
 *                           type: integer
 *                           description: Forms created in last 24 hours
 *                           example: 45
 *                         last7Days:
 *                           type: integer
 *                           description: Forms created in last 7 days
 *                           example: 320
 *                         last30Days:
 *                           type: integer
 *                           description: Forms created in last 30 days
 *                           example: 1250
 *                     errorRate:
 *                       type: number
 *                       description: Percentage of forms with errors
 *                       example: 0.024
 *                     aiSuggestionsUsed:
 *                       type: integer
 *                       description: Number of forms using AI suggestions
 *                       example: 850
 *                     timeRange:
 *                       type: object
 *                       description: Time range for statistics
 *                       properties:
 *                         start:
 *                           type: string
 *                           format: date-time
 *                           description: Statistics start date
 *                           example: "2024-01-01T00:00:00Z"
 *                         end:
 *                           type: string
 *                           format: date-time
 *                           description: Statistics end date
 *                           example: "2024-12-31T23:59:59Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  '/stats',
  authHandler(TaxFormController.getTaxFormStats)
);

/**
 * @swagger
 * /api/tax-forms/health:
 *   get:
 *     summary: Tax form service health check
 *     description: Check the health status of the tax form service and its dependencies
 *     tags: [Tax Forms]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy]
 *                       description: Overall service health status
 *                       example: "healthy"
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       description: Health check timestamp
 *                       example: "2024-01-15T10:30:00Z"
 *                     version:
 *                       type: string
 *                       description: Service version
 *                       example: "1.0.0"
 *                     dependencies:
 *                       type: object
 *                       properties:
 *                         database:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                               enum: [healthy, unhealthy]
 *                               description: Database connection status
 *                               example: "healthy"
 *                             responseTime:
 *                               type: number
 *                               description: Database response time in ms
 *                               example: 45
 *                         aiService:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                               enum: [healthy, unhealthy]
 *                               description: AI service status
 *                               example: "healthy"
 *                             responseTime:
 *                               type: number
 *                               description: AI service response time in ms
 *                               example: 120
 *       503:
 *         description: Service is unavailable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       description: Error code
 *                       example: "SERVICE_UNAVAILABLE"
 *                     message:
 *                       type: string
 *                       description: Error message
 *                       example: "Tax form service is currently unavailable"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  '/health',
  TaxFormController.healthCheck
);

export { router as taxFormRoutes };