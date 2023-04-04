import { AxiosProgressEvent } from "axios";

export type SpeedleConfig = {
  url: string;
  outputPath: string;
  headers?: {
    [key: string]: string | undefined;
  };
  overwrite?: boolean;
  resumable?: boolean;
  timeout?: number;
  retryTimes?: number;
  onStart?: () => void;
  onProgress?: (AxiosProgressEvent) => void;
  onPause?: () => void;
  onResume?: () => void;
  onComplete?: () => void;
  onError?: (error: any) => void;
  onCancel?: () => void;
  onRetry?: () => void;
}
