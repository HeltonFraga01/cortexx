/**
 * Utilitários de teste reutilizáveis
 */

const request = require('supertest');

/**
 * Helpers para requisições autenticadas
 */
const createAuthenticatedRequest = (app, token) => {
  return {
    get: (path) => request(app).get(path).set('token', token),
    post: (path, data) => request(app).post(path).set('token', token).send(data),
    put: (path, data) => request(app).put(path).set('token', token).send(data),
    delete: (path) => request(app).delete(path).set('token', token)
  };
};

/**
 * Validar estrutura de resposta da API
 */
const validateApiResponse = (response, expectedFields = []) => {
  expect(response.body).toHaveProperty('success');
  
  if (response.body.success) {
    expect(response.body).toHaveProperty('data');
  } else {
    expect(response.body).toHaveProperty('error');
  }

  expectedFields.forEach(field => {
    expect(response.body).toHaveProperty(field);
  });
};

/**
 * Aguardar operação assíncrona
 */
const waitFor = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  createAuthenticatedRequest,
  validateApiResponse,
  waitFor
};