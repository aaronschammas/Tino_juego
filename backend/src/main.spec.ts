import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: jest.fn(),
  },
}));

jest.mock('./app.module', () => ({
  AppModule: class {},
}));

describe('Main', () => {
  let mockApp: any;

  beforeEach(() => {
    mockApp = {
      use: jest.fn(),
      useGlobalPipes: jest.fn(),
      enableCors: jest.fn(),
      listen: jest.fn().mockResolvedValue(true),
    };
    (NestFactory.create as jest.Mock).mockResolvedValue(mockApp);
    process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000';
    process.env.PORT = '3000';
  });

  it('should initialize the app correctly', async () => {
    // Arrange
    const { bootstrap } = require('./main');
    
    // Wait for the async bootstrap function to complete
    // Since bootstrap() is called at the bottom of main.ts, 
    // it starts executing as soon as we require it.
    await new Promise(resolve => setTimeout(resolve, 100));

    // Assert
    expect(NestFactory.create).toHaveBeenCalledWith(AppModule, {
      rawBody: true,
    });
    expect(mockApp.useGlobalPipes).toHaveBeenCalled();
    expect(mockApp.enableCors).toHaveBeenCalled();
    expect(mockApp.listen).toHaveBeenCalledWith('3000', '0.0.0.0');
  });
});
