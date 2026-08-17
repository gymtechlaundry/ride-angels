import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from '../supabase/supabase-client';
import { newUuid } from '../utils/uuid';

export type FeedbackKind = 'feature' | 'bug' | 'general';

export type FeedbackReply = {
  id: string;
  postId: string;
  authorId: string;
  authorDisplayName: string;
  authorAvatarUrl?: string;
  authorIsAppCreator: boolean;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type FeedbackPost = {
  id: string;
  authorId: string;
  authorDisplayName: string;
  authorAvatarUrl?: string;
  authorIsAppCreator: boolean;
  kind: FeedbackKind;
  title: string;
  body: string;
  screenshotUrls: string[];
  createdAt: string;
  updatedAt: string;
  replies: FeedbackReply[];
};

type FeedbackPostRow = {
  id: string;
  author_id: string;
  author_display_name: string;
  author_avatar_url: string | null;
  author_is_app_creator?: boolean | null;
  kind: FeedbackKind;
  title: string;
  body: string;
  screenshot_urls: string[] | null;
  created_at: string;
  updated_at?: string | null;
};

type FeedbackReplyRow = {
  id: string;
  post_id: string;
  author_id: string;
  author_display_name: string;
  author_avatar_url: string | null;
  author_is_app_creator?: boolean | null;
  body: string;
  created_at: string;
  updated_at?: string | null;
};

const MOCK_KEY = 'ra.feedback_threads.v2';
const POST_SELECT =
  'id, author_id, author_display_name, author_avatar_url, author_is_app_creator, kind, title, body, screenshot_urls, created_at, updated_at';
const REPLY_SELECT =
  'id, post_id, author_id, author_display_name, author_avatar_url, author_is_app_creator, body, created_at, updated_at';

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly posts = signal<FeedbackPost[]>([]);
  private readonly loading = signal(false);

  readonly items = this.posts.asReadonly();
  readonly isLoading = this.loading.asReadonly();

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      if (!isSupabaseConfigured()) {
        this.posts.set(this.readMock());
        return;
      }

      const supabase = getSupabaseClient();
      const [postsRes, repliesRes] = await Promise.all([
        supabase
          .from('feedback_posts')
          .select(POST_SELECT)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('feedback_replies')
          .select(REPLY_SELECT)
          .order('created_at', { ascending: true })
          .limit(500),
      ]);

      if (postsRes.error) {
        throw new Error(postsRes.error.message);
      }
      if (repliesRes.error) {
        throw new Error(repliesRes.error.message);
      }

      const repliesByPost = new Map<string, FeedbackReply[]>();
      for (const row of (repliesRes.data as FeedbackReplyRow[] | null) ?? []) {
        const reply = mapReplyRow(row);
        const list = repliesByPost.get(reply.postId) ?? [];
        list.push(reply);
        repliesByPost.set(reply.postId, list);
      }

      this.posts.set(
        ((postsRes.data as FeedbackPostRow[] | null) ?? []).map((row) =>
          mapPostRow(row, repliesByPost.get(row.id) ?? []),
        ),
      );
    } finally {
      this.loading.set(false);
    }
  }

  async createPost(input: {
    kind: FeedbackKind;
    title: string;
    body: string;
    screenshots: File[];
  }): Promise<FeedbackPost> {
    const user = this.auth.getCurrentUser();
    const title = input.title.trim();
    const body = input.body.trim();
    if (!title || !body) {
      throw new Error('Title and details are required.');
    }

    const screenshotUrls: string[] = [];
    for (const file of input.screenshots.slice(0, 3)) {
      screenshotUrls.push(await this.uploadScreenshot(file, user.authUserId));
    }

    const isCreator = this.auth.isAppCreator(user);
    const post: FeedbackPost = {
      id: newUuid(),
      authorId: user.id,
      authorDisplayName: user.displayName || 'Ride Angels member',
      authorAvatarUrl: user.avatarUrl,
      authorIsAppCreator: isCreator,
      kind: input.kind,
      title,
      body,
      screenshotUrls,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      replies: [],
    };

    if (!isSupabaseConfigured()) {
      const next = [post, ...this.readMock()];
      this.writeMock(next);
      this.posts.set(next);
      this.notifyMockNewPost(post);
      return post;
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('feedback_posts')
      .insert({
        author_id: user.id,
        author_display_name: post.authorDisplayName,
        author_avatar_url: post.authorAvatarUrl ?? null,
        author_is_app_creator: isCreator,
        kind: post.kind,
        title: post.title,
        body: post.body,
        screenshot_urls: post.screenshotUrls,
      })
      .select(POST_SELECT)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const mapped = mapPostRow(data as FeedbackPostRow, []);
    this.posts.update((list) => [mapped, ...list]);
    return mapped;
  }

  async createReply(postId: string, bodyRaw: string): Promise<FeedbackReply> {
    const user = this.auth.getCurrentUser();
    const body = bodyRaw.trim();
    if (!body) {
      throw new Error('Reply cannot be empty.');
    }

    const isCreator = this.auth.isAppCreator(user);
    const reply: FeedbackReply = {
      id: newUuid(),
      postId,
      authorId: user.id,
      authorDisplayName: user.displayName || 'Ride Angels member',
      authorAvatarUrl: user.avatarUrl,
      authorIsAppCreator: isCreator,
      body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!isSupabaseConfigured()) {
      const next = this.readMock().map((post) =>
        post.id === postId
          ? { ...post, replies: [...post.replies, reply] }
          : post,
      );
      this.writeMock(next);
      this.posts.set(next);
      this.notifyMockNewReply(postId, reply);
      return reply;
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('feedback_replies')
      .insert({
        post_id: postId,
        author_id: user.id,
        author_display_name: reply.authorDisplayName,
        author_avatar_url: reply.authorAvatarUrl ?? null,
        author_is_app_creator: isCreator,
        body: reply.body,
      })
      .select(REPLY_SELECT)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const mapped = mapReplyRow(data as FeedbackReplyRow);
    this.posts.update((list) =>
      list.map((post) =>
        post.id === postId
          ? { ...post, replies: [...post.replies, mapped] }
          : post,
      ),
    );
    return mapped;
  }

  async updatePost(
    postId: string,
    input: { kind: FeedbackKind; title: string; body: string },
  ): Promise<FeedbackPost> {
    const user = this.auth.getCurrentUser();
    const title = input.title.trim();
    const body = input.body.trim();
    if (!title || !body) {
      throw new Error('Title and details are required.');
    }

    const existing = this.posts().find((p) => p.id === postId);
    if (!existing) {
      throw new Error('Discussion not found.');
    }
    if (existing.authorId !== user.id) {
      throw new Error('You can only edit your own discussions.');
    }

    const updatedAt = new Date().toISOString();

    if (!isSupabaseConfigured()) {
      const next = this.readMock().map((post) =>
        post.id === postId
          ? {
              ...post,
              kind: input.kind,
              title,
              body,
              updatedAt,
            }
          : post,
      );
      this.writeMock(next);
      this.posts.set(next);
      const mapped = next.find((p) => p.id === postId);
      if (!mapped) {
        throw new Error('Discussion not found.');
      }
      return mapped;
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('feedback_posts')
      .update({
        kind: input.kind,
        title,
        body,
      })
      .eq('id', postId)
      .eq('author_id', user.id)
      .select(POST_SELECT)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const mapped = mapPostRow(
      data as FeedbackPostRow,
      existing.replies,
    );
    this.posts.update((list) =>
      list.map((post) => (post.id === postId ? mapped : post)),
    );
    return mapped;
  }

  async updateReply(postId: string, replyId: string, bodyRaw: string): Promise<FeedbackReply> {
    const user = this.auth.getCurrentUser();
    const body = bodyRaw.trim();
    if (!body) {
      throw new Error('Reply cannot be empty.');
    }

    const post = this.posts().find((p) => p.id === postId);
    const existing = post?.replies.find((r) => r.id === replyId);
    if (!existing) {
      throw new Error('Reply not found.');
    }
    if (existing.authorId !== user.id) {
      throw new Error('You can only edit your own replies.');
    }

    const updatedAt = new Date().toISOString();

    if (!isSupabaseConfigured()) {
      let mapped: FeedbackReply | null = null;
      const next = this.readMock().map((p) => {
        if (p.id !== postId) {
          return p;
        }
        return {
          ...p,
          replies: p.replies.map((r) => {
            if (r.id !== replyId) {
              return r;
            }
            mapped = { ...r, body, updatedAt };
            return mapped;
          }),
        };
      });
      this.writeMock(next);
      this.posts.set(next);
      if (!mapped) {
        throw new Error('Reply not found.');
      }
      return mapped;
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('feedback_replies')
      .update({ body })
      .eq('id', replyId)
      .eq('author_id', user.id)
      .select(REPLY_SELECT)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const mapped = mapReplyRow(data as FeedbackReplyRow);
    this.posts.update((list) =>
      list.map((p) =>
        p.id === postId
          ? {
              ...p,
              replies: p.replies.map((r) => (r.id === replyId ? mapped : r)),
            }
          : p,
      ),
    );
    return mapped;
  }

  async deletePost(postId: string): Promise<void> {
    const user = this.auth.getCurrentUser();
    const post = this.posts().find((p) => p.id === postId);
    if (!post) {
      return;
    }
    const canDelete =
      post.authorId === user.id || this.auth.isAppCreator(user);
    if (!canDelete) {
      throw new Error('You can only delete your own posts.');
    }

    if (!isSupabaseConfigured()) {
      const next = this.readMock().filter((p) => p.id !== postId);
      this.writeMock(next);
      this.posts.set(next);
      return;
    }

    const supabase = getSupabaseClient();
    let query = supabase.from('feedback_posts').delete().eq('id', postId);
    if (!this.auth.isAppCreator(user)) {
      query = query.eq('author_id', user.id);
    }
    const { error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    this.posts.update((list) => list.filter((p) => p.id !== postId));
  }

  async deleteReply(postId: string, replyId: string): Promise<void> {
    const user = this.auth.getCurrentUser();
    const post = this.posts().find((p) => p.id === postId);
    const reply = post?.replies.find((r) => r.id === replyId);
    if (!reply) {
      return;
    }
    const canDelete =
      reply.authorId === user.id || this.auth.isAppCreator(user);
    if (!canDelete) {
      throw new Error('You can only delete your own replies.');
    }

    if (!isSupabaseConfigured()) {
      const next = this.readMock().map((p) =>
        p.id === postId
          ? { ...p, replies: p.replies.filter((r) => r.id !== replyId) }
          : p,
      );
      this.writeMock(next);
      this.posts.set(next);
      return;
    }

    const supabase = getSupabaseClient();
    let query = supabase.from('feedback_replies').delete().eq('id', replyId);
    if (!this.auth.isAppCreator(user)) {
      query = query.eq('author_id', user.id);
    }
    const { error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    this.posts.update((list) =>
      list.map((p) =>
        p.id === postId
          ? { ...p, replies: p.replies.filter((r) => r.id !== replyId) }
          : p,
      ),
    );
  }

  private async uploadScreenshot(file: File, authUserId: string): Promise<string> {
    if (!isSupabaseConfigured()) {
      return await fileToDataUrl(file);
    }

    const mime = file.type || 'image/jpeg';
    const ext =
      mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const path = `${authUserId}/${newUuid()}.${ext}`;
    const supabase = getSupabaseClient();
    const { error } = await supabase.storage
      .from('feedback-screenshots')
      .upload(path, file, { upsert: false, contentType: mime });
    if (error) {
      throw new Error(error.message);
    }
    const { data } = supabase.storage
      .from('feedback-screenshots')
      .getPublicUrl(path);
    return data.publicUrl;
  }

  /** Local/mock fan-out — live path uses DB triggers. */
  private notifyMockNewPost(post: FeedbackPost): void {
    const kindLabel =
      post.kind === 'feature'
        ? 'feature idea'
        : post.kind === 'bug'
          ? 'bug report'
          : 'discussion';
    for (const user of this.auth.listUsers()) {
      if (user.id === post.authorId || !user.onboardingCompleted) {
        continue;
      }
      this.notifications.notify({
        userId: user.id,
        type: 'discussion_posted',
        title: 'New discussion',
        body: `${post.authorDisplayName} posted a ${kindLabel}: ${post.title}`,
      });
    }
  }

  private notifyMockNewReply(postId: string, reply: FeedbackReply): void {
    const post = this.posts().find((p) => p.id === postId);
    if (!post) {
      return;
    }
    const recipientIds = new Set<string>([post.authorId]);
    for (const existing of post.replies) {
      if (existing.id !== reply.id) {
        recipientIds.add(existing.authorId);
      }
    }
    recipientIds.delete(reply.authorId);
    const snippet = reply.body.replace(/\s+/g, ' ').trim().slice(0, 100);
    for (const userId of recipientIds) {
      this.notifications.notify({
        userId,
        type: 'discussion_reply',
        title: 'New reply',
        body: `${reply.authorDisplayName} replied on "${post.title}"${
          snippet ? `: ${snippet}` : ''
        }`,
      });
    }
  }

  private readMock(): FeedbackPost[] {
    try {
      const raw = localStorage.getItem(MOCK_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as FeedbackPost[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.map((p) => ({
        ...p,
        authorIsAppCreator: !!p.authorIsAppCreator,
        updatedAt: p.updatedAt || p.createdAt,
        replies: Array.isArray(p.replies)
          ? p.replies.map((r) => ({
              ...r,
              authorIsAppCreator: !!r.authorIsAppCreator,
              updatedAt: r.updatedAt || r.createdAt,
            }))
          : [],
      }));
    } catch {
      return [];
    }
  }

  private writeMock(posts: FeedbackPost[]): void {
    localStorage.setItem(MOCK_KEY, JSON.stringify(posts));
  }
}

function mapPostRow(row: FeedbackPostRow, replies: FeedbackReply[]): FeedbackPost {
  return {
    id: row.id,
    authorId: row.author_id,
    authorDisplayName: row.author_display_name,
    authorAvatarUrl: row.author_avatar_url ?? undefined,
    authorIsAppCreator: !!row.author_is_app_creator,
    kind: row.kind,
    title: row.title,
    body: row.body,
    screenshotUrls: row.screenshot_urls ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    replies,
  };
}

function mapReplyRow(row: FeedbackReplyRow): FeedbackReply {
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    authorDisplayName: row.author_display_name,
    authorAvatarUrl: row.author_avatar_url ?? undefined,
    authorIsAppCreator: !!row.author_is_app_creator,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read screenshot.'));
    reader.readAsDataURL(file);
  });
}
