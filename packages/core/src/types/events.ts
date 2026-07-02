/**
 * Event types for the Design Intelligence MCP core engine.
 */

export type EventType =
  | 'project.imported'
  | 'design.compiled'
  | 'project.analyzed'
  | 'plan.generated'
  | 'widget.generated'
  | 'validation.completed'
  | 'integration.completed'
  | 'error'
  | 'progress';

export interface BaseEvent {
  type: EventType;
  timestamp: string;
  projectId: string;
}

export interface ProjectImportedEvent extends BaseEvent {
  type: 'project.imported';
  figmaFileKey: string;
  flutterProjectPath: string;
}

export interface DesignCompiledEvent extends BaseEvent {
  type: 'design.compiled';
  designGraphId: string;
  nodeCount: number;
  componentCount: number;
  pageNames: string[];
}

export interface ProjectAnalyzedEvent extends BaseEvent {
  type: 'project.analyzed';
  projectGraphId: string;
  widgetCount: number;
  routeCount: number;
  themeColorCount: number;
}

export interface PlanGeneratedEvent extends BaseEvent {
  type: 'plan.generated';
  planId: string;
  taskCount: number;
  estimatedTimeMs: number;
}

export interface WidgetGeneratedEvent extends BaseEvent {
  type: 'widget.generated';
  widgetName: string;
  filePath: string;
  success: boolean;
}

export interface ValidationCompletedEvent extends BaseEvent {
  type: 'validation.completed';
  passed: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export interface IntegrationCompletedEvent extends BaseEvent {
  type: 'integration.completed';
  filesModified: number;
  filesCreated: number;
  routesUpdated: string[];
}

export interface ErrorEvent extends BaseEvent {
  type: 'error';
  message: string;
  stack?: string;
  code?: string;
}

export interface ProgressEvent extends BaseEvent {
  type: 'progress';
  message: string;
  percentage: number;
  current: number;
  total: number;
}

export type ValidationError = {
  file: string;
  line?: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning';
};

export type CoreEvent =
  | ProjectImportedEvent
  | DesignCompiledEvent
  | ProjectAnalyzedEvent
  | PlanGeneratedEvent
  | WidgetGeneratedEvent
  | ValidationCompletedEvent
  | IntegrationCompletedEvent
  | ErrorEvent
  | ProgressEvent;

export type EventCallback<T extends BaseEvent = CoreEvent> = (event: T) => void;