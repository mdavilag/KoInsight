import express from 'express';
import request from 'supertest';
import { expectedToken } from '../auth/auth-token';
import { appConfig } from '../config';
import { createBook } from '../db/factories/book-factory';
import { db } from '../knex';
import { booksRouter } from './books-router';

describe('books-router', () => {
  const app = express();
  app.use(express.json());
  app.use('/books', booksRouter);

  const authCookie = `${appConfig.auth.cookieName}=${expectedToken()}`;

  describe('GET /books', () => {
    it('returns all books as JSON', async () => {
      await createBook(db, { title: 'Book 1' });

      let response = await request(app).get('/books');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toEqual(expect.objectContaining({ title: 'Book 1' }));

      await createBook(db, { title: 'Book 2' });

      response = await request(app).get('/books');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[1]).toEqual(expect.objectContaining({ title: 'Book 2' }));
    });

    it('excludes hidden books by default', async () => {
      await createBook(db, { title: 'Visible Book', soft_deleted: false });
      await createBook(db, { title: 'Hidden Book', soft_deleted: true });

      const response = await request(app).get('/books');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Visible Book');
    });

    it('includes hidden books when showHidden=true', async () => {
      await createBook(db, { title: 'Visible Book', soft_deleted: false });
      await createBook(db, { title: 'Hidden Book', soft_deleted: true });

      const response = await request(app).get('/books?showHidden=true');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });
  });

  describe('GET /books/:bookId', () => {
    it('returns a book by id', async () => {
      const book = await createBook(db, { title: 'Test Book' });

      const response = await request(app).get(`/books/${book.id}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({ title: 'Test Book' }));
    });
  });

  describe('mutation routes require authentication', () => {
    it('returns 401 without a session cookie', async () => {
      const book = await createBook(db);

      await request(app).delete(`/books/${book.id}`).expect(401);
      await request(app).put(`/books/${book.id}/hide`).send({ hidden: true }).expect(401);
      await request(app).post(`/books/${book.id}/genres`).send({ genreName: 'Sci-Fi' }).expect(401);
      await request(app)
        .put(`/books/${book.id}/reference_pages`)
        .send({ reference_pages: 100 })
        .expect(401);
      await request(app).put(`/books/${book.id}/status`).send({ status: 'read' }).expect(401);
    });

    it('still allows anonymous reads', async () => {
      await createBook(db, { title: 'Public Book' });
      await request(app).get('/books').expect(200);
    });
  });

  describe('DELETE /books/:bookId', () => {
    it('deletes a book', async () => {
      const book = await createBook(db, { title: 'Book to Delete' });

      const response = await request(app).delete(`/books/${book.id}`).set('Cookie', authCookie);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Book deleted' });
    });
  });

  describe('PUT /books/:bookId/hide', () => {
    it('hides a book', async () => {
      const book = await createBook(db, { title: 'Book to Hide', soft_deleted: false });

      const response = await request(app)
        .put(`/books/${book.id}/hide`)
        .set('Cookie', authCookie)
        .send({ hidden: true });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Book hidden' });
    });

    it('shows a hidden book', async () => {
      const book = await createBook(db, { title: 'Hidden Book', soft_deleted: true });

      const response = await request(app)
        .put(`/books/${book.id}/hide`)
        .set('Cookie', authCookie)
        .send({ hidden: false });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Book shown' });
    });

    it('returns 400 when hidden field is missing', async () => {
      const book = await createBook(db);

      const response = await request(app)
        .put(`/books/${book.id}/hide`)
        .set('Cookie', authCookie)
        .send({});
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Missing required fields' });
    });
  });

  describe('POST /books/:bookId/genres', () => {
    it('adds a genre to a book', async () => {
      const book = await createBook(db);

      const response = await request(app)
        .post(`/books/${book.id}/genres`)
        .set('Cookie', authCookie)
        .send({ genreName: 'Fantasy' });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Genre added' });
    });

    it('returns 400 when genreName is missing', async () => {
      const book = await createBook(db);

      const response = await request(app)
        .post(`/books/${book.id}/genres`)
        .set('Cookie', authCookie)
        .send({});
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Missing required fields' });
    });
  });

  describe('PUT /books/:bookId/reference_pages', () => {
    it('updates reference pages', async () => {
      const book = await createBook(db, { reference_pages: 100 });

      const response = await request(app)
        .put(`/books/${book.id}/reference_pages`)
        .set('Cookie', authCookie)
        .send({ reference_pages: 250 });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Reference pages updated' });
    });

    it('returns 400 when reference_pages is missing', async () => {
      const book = await createBook(db);

      const response = await request(app)
        .put(`/books/${book.id}/reference_pages`)
        .set('Cookie', authCookie)
        .send({});
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Missing required fields' });
    });
  });

  describe('PUT /books/:bookId/status', () => {
    it('sets a status override', async () => {
      const book = await createBook(db);

      const response = await request(app)
        .put(`/books/${book.id}/status`)
        .set('Cookie', authCookie)
        .send({ status: 'read' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Book status updated' });

      const updated = await db('book').where({ id: book.id }).first();
      expect(updated.status_override).toBe('read');
    });

    it('clears the override when the status is null', async () => {
      const book = await createBook(db, { status_override: 'read' });

      const response = await request(app)
        .put(`/books/${book.id}/status`)
        .set('Cookie', authCookie)
        .send({ status: null });

      expect(response.status).toBe(200);

      const updated = await db('book').where({ id: book.id }).first();
      expect(updated.status_override).toBeNull();
    });

    it('returns 400 for an unknown status', async () => {
      const book = await createBook(db);

      const response = await request(app)
        .put(`/books/${book.id}/status`)
        .set('Cookie', authCookie)
        .send({ status: 'finished' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid status' });
    });
  });
});
