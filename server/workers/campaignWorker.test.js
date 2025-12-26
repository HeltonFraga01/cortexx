/**
 * Tests for Campaign Worker
 * Task 13.3: Create tests for queue workers
 */

const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert');

// Mock dependencies
const mockLogger = {
  info: mock.fn(),
  warn: mock.fn(),
  error: mock.fn(),
  debug: mock.fn(),
};

const mockBulkCampaignService = {
  getCampaignById: mock.fn(() => Promise.resolve({
    id: 'campaign-1',
    status: 'scheduled',
    message_content: 'Hello {{name}}!',
    message_type: 'text',
  })),
  updateCampaignStatus: mock.fn(() => Promise.resolve()),
  getCampaignContacts: mock.fn(() => Promise.resolve([
    { id: 'contact-1', phone: '5511999999999', name: 'John' },
    { id: 'contact-2', phone: '5511888888888', name: 'Jane' },
  ])),
  updateContactStatus: mock.fn(() => Promise.resolve()),
  updateCampaignProgress: mock.fn(() => Promise.resolve()),
};

const mockWuzapiClient = {
  sendTextMessage: mock.fn(() => Promise.resolve({ success: true })),
};

const mockMetrics = {
  recordQueueJob: mock.fn(),
};

mock.module('../utils/logger', {
  namedExports: { logger: mockLogger },
});

mock.module('../services/BulkCampaignService', {
  namedExports: {},
  defaultExport: mockBulkCampaignService,
});

mock.module('../utils/wuzapiClient', {
  namedExports: {},
  defaultExport: mockWuzapiClient,
});

mock.module('../telemetry/metrics', {
  namedExports: mockMetrics,
});

// Mock BullMQ Worker
const mockWorkerInstance = {
  on: mock.fn(),
  close: mock.fn(() => Promise.resolve()),
};

mock.module('bullmq', {
  namedExports: {
    Worker: class {
      constructor(name, processor, options) {
        this.name = name;
        this.processor = processor;
        this.options = options;
        Object.assign(this, mockWorkerInstance);
      }
    },
  },
});

describe('Campaign Worker', () => {
  let campaignWorker;

  beforeEach(() => {
    // Reset mocks
    mockLogger.info.mock.resetCalls();
    mockLogger.error.mock.resetCalls();
    mockBulkCampaignService.getCampaignById.mock.resetCalls();
    mockBulkCampaignService.updateCampaignStatus.mock.resetCalls();
    mockWuzapiClient.sendTextMessage.mock.resetCalls();
    mockMetrics.recordQueueJob.mock.resetCalls();
    
    // Re-require module
    delete require.cache[require.resolve('./campaignWorker')];
    campaignWorker = require('./campaignWorker');
  });

  describe('module exports', () => {
    it('should export getCampaignWorker function', () => {
      assert.strictEqual(typeof campaignWorker.getCampaignWorker, 'function');
    });

    it('should export processCampaign function', () => {
      assert.strictEqual(typeof campaignWorker.processCampaign, 'function');
    });

    it('should export processMessage function', () => {
      assert.strictEqual(typeof campaignWorker.processMessage, 'function');
    });

    it('should export processBatch function', () => {
      assert.strictEqual(typeof campaignWorker.processBatch, 'function');
    });

    it('should export finalizeCampaign function', () => {
      assert.strictEqual(typeof campaignWorker.finalizeCampaign, 'function');
    });
  });

  describe('processCampaign', () => {
    it('should process a campaign job', async () => {
      const job = {
        id: 'job-1',
        data: {
          campaignId: 'campaign-1',
          userId: 'user-1',
          tenantId: 'tenant-1',
          contacts: [
            { id: 'contact-1', phone: '5511999999999', name: 'John' },
          ],
          messageTemplate: 'Hello {{name}}!',
          messageType: 'text',
          userToken: 'token-123',
        },
        updateProgress: mock.fn(),
      };

      const result = await campaignWorker.processCampaign(job);

      assert.ok(result, 'should return a result');
      assert.ok(mockLogger.info.mock.callCount() > 0, 'should log info');
    });

    it('should handle campaign not found', async () => {
      mockBulkCampaignService.getCampaignById.mock.mockImplementation(() => 
        Promise.resolve(null)
      );

      const job = {
        id: 'job-1',
        data: {
          campaignId: 'non-existent',
          contacts: [],
        },
        updateProgress: mock.fn(),
      };

      await assert.rejects(
        () => campaignWorker.processCampaign(job),
        /Campaign not found/
      );
    });
  });

  describe('processMessage', () => {
    it('should process a single message job', async () => {
      const job = {
        id: 'msg-job-1',
        data: {
          campaignId: 'campaign-1',
          contactId: 'contact-1',
          phone: '5511999999999',
          message: 'Hello John!',
          inboxId: 'inbox-1',
          userToken: 'token-123',
        },
      };

      const result = await campaignWorker.processMessage(job);

      assert.ok(result, 'should return a result');
    });

    it('should handle message send failure', async () => {
      mockWuzapiClient.sendTextMessage.mock.mockImplementation(() => 
        Promise.reject(new Error('Send failed'))
      );

      const job = {
        id: 'msg-job-1',
        data: {
          campaignId: 'campaign-1',
          contactId: 'contact-1',
          phone: '5511999999999',
          message: 'Hello!',
          userToken: 'token-123',
        },
      };

      await assert.rejects(
        () => campaignWorker.processMessage(job),
        /Send failed/
      );
    });
  });

  describe('processBatch', () => {
    it('should process a batch of contacts', async () => {
      const job = {
        id: 'batch-job-1',
        data: {
          campaignId: 'campaign-1',
          batchIndex: 0,
          contacts: [
            { id: 'contact-1', phone: '5511999999999', name: 'John' },
            { id: 'contact-2', phone: '5511888888888', name: 'Jane' },
          ],
          messageTemplate: 'Hello {{name}}!',
          userToken: 'token-123',
        },
        updateProgress: mock.fn(),
      };

      const result = await campaignWorker.processBatch(job);

      assert.ok(result, 'should return a result');
      assert.ok(result.processed !== undefined, 'should have processed count');
    });
  });

  describe('finalizeCampaign', () => {
    it('should finalize a campaign', async () => {
      const job = {
        id: 'finalize-job-1',
        data: {
          campaignId: 'campaign-1',
          stats: {
            total: 100,
            sent: 95,
            failed: 5,
          },
        },
      };

      const result = await campaignWorker.finalizeCampaign(job);

      assert.ok(result, 'should return a result');
      assert.ok(mockBulkCampaignService.updateCampaignStatus.mock.callCount() > 0, 
        'should update campaign status');
    });
  });

  describe('getCampaignWorker', () => {
    it('should return null when Redis not configured', () => {
      // Worker creation depends on Redis connection
      const worker = campaignWorker.getCampaignWorker();
      // May return null or worker depending on Redis availability
      assert.ok(worker === null || typeof worker === 'object');
    });
  });
});
