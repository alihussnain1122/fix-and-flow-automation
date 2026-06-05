export enum JobName {
  CREATE_POST = 'create-post-job',
  CHECK_INBOX = 'check-inbox-job',
  VERIFY_ACCOUNT = 'verify-account-job',
  ROTATE_PROXY = 'rotate-proxy-job',
}

export interface CreatePostJobData {
  postId: string;
  accountId: string;
  title: string;
  description: string;
  price: number | null;
  imageUrls: string[];
}

export interface CheckInboxJobData {
  accountId: string;
}

export interface VerifyAccountJobData {
  accountId: string;
}

export interface RotateProxyJobData {
  accountId: string;
  proxyId: string;
}

export type JobData =
  | CreatePostJobData
  | CheckInboxJobData
  | VerifyAccountJobData
  | RotateProxyJobData;
