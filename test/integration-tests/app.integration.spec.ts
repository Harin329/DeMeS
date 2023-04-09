import 'jest';
import * as express from 'express';
import * as request from 'supertest';
import { StatusCodes } from 'http-status-codes';
import IntegrationHelpers from '../helpers/Integration-helpers';

describe('status integration tests', () => {
    let app: express.Application;

    beforeAll(async() => {
        process.env.PORT = '3000';
        app = await IntegrationHelpers.getApp();
    });

    afterAll(() => {
        delete process.env.PORT; // unset the PORT environment variable
    });

    // router.get('/api/port', (_, res) => {
    //    res.json(process.env.PORT);
    // });

    test("GET /api/port", (done) => {
        request(app)
            .get("/api/port")
            .expect("Content-Type", /json/)
            .expect(StatusCodes.OK)
            .expect((res) => {
                const port = res.body;
                expect(port).toBe("3000");
            })
            .end(done);
    });

});