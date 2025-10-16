const httpMocks = require('node-mocks-http');
const axios = require('axios');

// Mock de axios antes de importar el controlador
jest.mock('axios');

const newsCtrl = require('../../../controllers/news');

describe('controllers/news.getNews', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeArticles(n) {
    return Array.from({ length: n }, (_, i) => ({ title: `a${i + 1}` }));
  }

  it('✅ 200: devuelve "News fetched" y como mucho 10 artículos (cuando hay >10)', async () => {
    const bigList = makeArticles(25);
    axios.get.mockResolvedValueOnce({ data: { articles: bigList } });

    const req = httpMocks.createRequest({ method: 'GET' });
    const res = httpMocks.createResponse();

    await newsCtrl.getNews(req, res);

    expect(axios.get).toHaveBeenCalledTimes(1);
    const calledUrl = axios.get.mock.calls[0][0];
    expect(calledUrl).toContain('newsapi.org/v2/top-headlines');
    expect(calledUrl).toContain('country=in');
    expect(calledUrl).toContain('category=technology');

    expect(res.statusCode).toBe(200);
    const body = res._getJSONData();
    expect(body.msg).toMatch(/News fetched/i);
    expect(Array.isArray(body.news)).toBe(true);
    expect(body.news).toHaveLength(10); // capped a 10
    // sanity: el primer y último elemento son del feed original
    expect(body.news[0].title).toBe('a1');
    expect(body.news[9].title).toBe('a10');
  });

  it('✅ 200: cuando hay menos de 10 artículos, devuelve todos (p. ej. 3)', async () => {
    const smallList = makeArticles(3);
    axios.get.mockResolvedValueOnce({ data: { articles: smallList } });

    const req = httpMocks.createRequest({ method: 'GET' });
    const res = httpMocks.createResponse();

    await newsCtrl.getNews(req, res);

    expect(res.statusCode).toBe(200);
    const body = res._getJSONData();
    expect(body.msg).toMatch(/News fetched/i);
    expect(body.news).toHaveLength(3);
    expect(body.news.map(a => a.title)).toEqual(['a1', 'a2', 'a3']);
  });

  it('✅ 200: exactamente 10 artículos devuelve 10', async () => {
    const ten = makeArticles(10);
    axios.get.mockResolvedValueOnce({ data: { articles: ten } });

    const req = httpMocks.createRequest({ method: 'GET' });
    const res = httpMocks.createResponse();

    await newsCtrl.getNews(req, res);

    expect(res.statusCode).toBe(200);
    const body = res._getJSONData();
    expect(body.news).toHaveLength(10);
  });

  it('✅ 200: lista vacía devuelve []', async () => {
    axios.get.mockResolvedValueOnce({ data: { articles: [] } });

    const req = httpMocks.createRequest({ method: 'GET' });
    const res = httpMocks.createResponse();

    await newsCtrl.getNews(req, res);

    expect(res.statusCode).toBe(200);
    const body = res._getJSONData();
    expect(body.news).toEqual([]);
  });

  it('💥 500: si axios.get rechaza, responde 500 con mensaje genérico', async () => {
    axios.get.mockRejectedValueOnce(new Error('provider down'));

    const req = httpMocks.createRequest({ method: 'GET' });
    const res = httpMocks.createResponse();

    await newsCtrl.getNews(req, res);

    expect(res.statusCode).toBe(500);
    const body = res._getJSONData();
    expect(body.msg).toMatch(/Something went wrong/i);
  });
});
