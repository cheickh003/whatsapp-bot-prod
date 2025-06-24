import { ChatContext } from '../../src/types';

export function createMockContext(overrides?: Partial<ChatContext>): ChatContext {
  return {
    conversationId: 'test-conversation-id',
    phoneNumber: '+22570000000',
    messageHistory: [],
    ...overrides
  };
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function mockDate(date: Date | string) {
  const mockDate = new Date(date);
  jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());
  jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
  return () => {
    jest.spyOn(Date, 'now').mockRestore();
    jest.spyOn(global, 'Date').mockRestore();
  };
}

export function createMockAdmin(overrides?: any) {
  return {
    $id: 'admin-id',
    phoneNumber: '+22579999999',
    role: 'admin',
    name: 'Test Admin',
    createdAt: new Date().toISOString(),
    addedBy: 'system',
    ...overrides
  };
}

export function createMockUser(overrides?: any) {
  return {
    phoneNumber: '+22570000000',
    dailyLimit: 50,
    lastMessageAt: new Date().toISOString(),
    messageCount: 0,
    ...overrides
  };
}

export function createMockDocument(collection: string, data: any) {
  return {
    $id: `${collection}-${Date.now()}`,
    $collectionId: collection,
    $databaseId: 'jarvis_db',
    $createdAt: new Date().toISOString(),
    $updatedAt: new Date().toISOString(),
    ...data
  };
}

export class MockLogger {
  info = jest.fn();
  warn = jest.fn();
  error = jest.fn();
  debug = jest.fn();
}

export class MockAppwriteService {
  testConnection = jest.fn().mockResolvedValue(true);
  createDocument = jest.fn().mockImplementation((db, collection, data) => 
    Promise.resolve(createMockDocument(collection, data))
  );
  updateDocument = jest.fn().mockResolvedValue({});
  deleteDocument = jest.fn().mockResolvedValue({});
  listDocuments = jest.fn().mockResolvedValue([]);
  getDocument = jest.fn().mockResolvedValue(null);
}

export function expectToHaveBeenCalledWithPartial(
  mockFn: jest.Mock,
  partial: any,
  callIndex = 0
) {
  expect(mockFn).toHaveBeenCalled();
  const call = mockFn.mock.calls[callIndex];
  expect(call).toBeDefined();
  
  if (typeof partial === 'object') {
    Object.keys(partial).forEach(key => {
      expect(call[0]).toHaveProperty(key, partial[key]);
    });
  } else {
    expect(call[0]).toEqual(partial);
  }
}

export function resetAllMocks(...mocks: jest.Mock[]) {
  mocks.forEach(mock => {
    mock.mockClear();
    mock.mockReset();
  });
}

export function createMockError(message: string, code?: string) {
  const error = new Error(message);
  if (code) {
    (error as any).code = code;
  }
  return error;
}