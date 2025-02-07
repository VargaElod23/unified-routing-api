import { AxiosInstance } from 'axios';
import NodeCache from 'node-cache';
import { DEFAULT_NEGATIVE_CACHE_ENTRY_TTL, DEFAULT_POSITIVE_CACHE_ENTRY_TTL } from '../../../../lib/constants';
import { GetPortionResponse, GET_NO_PORTION_RESPONSE, PortionFetcher } from '../../../../lib/fetchers/PortionFetcher';
import axios from '../../../../lib/providers/quoters/helpers';
import { forcePortion, setGlobalForcePortion } from '../../../../lib/util/portion';
import { FLAT_PORTION } from '../../../constants';

function testPortion() {
  const tokenInChainId = 1;
  const tokenInAddress = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984';
  const tokenOutChainId = 1;
  const tokenOutAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
  const PORTION_CACHE_KEY = (
    tokenInChainId: number,
    tokenOutChainId: number,
    tokenInAddress: string,
    tokenOutAddress: string
  ) =>
    `PortionFetcher-${tokenInChainId}-${tokenInAddress.toLowerCase()}-${tokenOutChainId}-${tokenOutAddress.toLowerCase()}`;

  it('Portion Service returns portion data', async () => {
    const portionResponse: GetPortionResponse = {
      hasPortion: true,
      portion: FLAT_PORTION,
    };

    const createSpy = jest.spyOn(axios, 'create');
    // @ts-ignore
    const axiosInstanceMock: AxiosInstance = {
      get: jest.fn().mockResolvedValue({ data: portionResponse }),
      // You can optionally mock other methods here, such as post, put, etc.
    };
    createSpy.mockReturnValueOnce(axiosInstanceMock);
    const currentEpochTimeInSeconds = Math.floor(Date.now() / 1000);

    const portionCache = new NodeCache({ stdTTL: 600 });
    const portionFetcher = new PortionFetcher('https://portion.uniswap.org/', portionCache);
    const portionData = await portionFetcher.getPortion(
      tokenInChainId,
      tokenInAddress,
      tokenOutChainId,
      tokenOutAddress
    );
    expect(portionData.hasPortion).toEqual(true);
    expect(portionData.portion).toBeDefined;

    if (portionData.hasPortion && portionData.portion) {
      expect(portionData.portion).toStrictEqual(portionResponse.portion);

      const cachedPortionData = portionCache.get<GetPortionResponse>(
        PORTION_CACHE_KEY(tokenInChainId, tokenOutChainId, tokenInAddress, tokenOutAddress)
      );

      if (!forcePortion) {
        expect(cachedPortionData).toBeDefined;
        expect(cachedPortionData?.portion).toBeDefined;
        expect(cachedPortionData?.hasPortion).toEqual(true);
        expect(cachedPortionData?.portion).toStrictEqual(portionResponse.portion);

        const ttlUpperBoundBuffer = 1; // in seconds
        const ttl = portionCache.getTtl(
          PORTION_CACHE_KEY(tokenInChainId, tokenOutChainId, tokenInAddress, tokenOutAddress)
        );
        expect(Math.floor((ttl ?? 0) / 1000)).toBeGreaterThanOrEqual(
          currentEpochTimeInSeconds + DEFAULT_POSITIVE_CACHE_ENTRY_TTL
        );
        expect(Math.floor((ttl ?? 0) / 1000)).toBeLessThanOrEqual(
          currentEpochTimeInSeconds + DEFAULT_POSITIVE_CACHE_ENTRY_TTL + ttlUpperBoundBuffer
        );
      } else {
        expect(cachedPortionData).toBeUndefined;
      }
    }
  });

  it('Portion Service returns no portion data', async () => {
    const createSpy = jest.spyOn(axios, 'create');
    // @ts-ignore
    const axiosInstanceMock: AxiosInstance = {
      get: jest.fn().mockResolvedValue({ data: GET_NO_PORTION_RESPONSE }),
      // You can optionally mock other methods here, such as post, put, etc.
    };
    createSpy.mockReturnValueOnce(axiosInstanceMock);
    const currentEpochTimeInSeconds = Math.floor(Date.now() / 1000);

    const portionCache = new NodeCache({ stdTTL: 600 });
    const portionFetcher = new PortionFetcher('https://portion.uniswap.org/', portionCache);
    const portionData = await portionFetcher.getPortion(
      tokenInChainId,
      tokenInAddress,
      tokenOutChainId,
      tokenOutAddress
    );
    expect(portionData.hasPortion).toEqual(GET_NO_PORTION_RESPONSE.hasPortion);

    const cachedPortionData = portionCache.get<GetPortionResponse>(
      PORTION_CACHE_KEY(tokenInChainId, tokenOutChainId, tokenInAddress, tokenOutAddress)
    );

    if (!forcePortion) {
      expect(cachedPortionData).toBeDefined;
      expect(cachedPortionData?.hasPortion).toEqual(GET_NO_PORTION_RESPONSE.hasPortion);

      const ttlUpperBoundBuffer = 1; // in seconds
      const ttl = portionCache.getTtl(
        PORTION_CACHE_KEY(tokenInChainId, tokenOutChainId, tokenInAddress, tokenOutAddress)
      );
      expect(Math.floor((ttl ?? 0) / 1000)).toBeGreaterThanOrEqual(
        currentEpochTimeInSeconds + DEFAULT_NEGATIVE_CACHE_ENTRY_TTL
      );
      expect(Math.floor((ttl ?? 0) / 1000)).toBeLessThanOrEqual(
        currentEpochTimeInSeconds + DEFAULT_NEGATIVE_CACHE_ENTRY_TTL + ttlUpperBoundBuffer
      );
    } else {
      expect(cachedPortionData).toBeUndefined;
    }
  });

  it('Portion Service encounters runtime error', async () => {
    const createSpy = jest.spyOn(axios, 'create');
    // @ts-ignore
    const axiosInstanceMock: AxiosInstance = {
      get: jest.fn().mockRejectedValue(new Error('Portion Service Error')),
      // You can optionally mock other methods here, such as post, put, etc.
    };
    createSpy.mockReturnValueOnce(axiosInstanceMock);

    const portionCache = new NodeCache({ stdTTL: 600 });
    const portionFetcher = new PortionFetcher('https://portion.uniswap.org/', portionCache);
    const portionData = await portionFetcher.getPortion(
      tokenInChainId,
      tokenInAddress,
      tokenOutChainId,
      tokenOutAddress
    );
    expect(portionData.hasPortion).toEqual(GET_NO_PORTION_RESPONSE.hasPortion);

    const cachedPortionData = portionCache.get<GetPortionResponse>(
      PORTION_CACHE_KEY(tokenInChainId, tokenOutChainId, tokenInAddress, tokenOutAddress)
    );
    expect(cachedPortionData).toBeUndefined;
  });
}

describe('PortionFetcher Unit Tests', () => {
  describe('with ENABLE_PORTION flag', () => {
    beforeEach(() => {
      process.env.ENABLE_PORTION = 'true';
      setGlobalForcePortion(false);
    });

    afterEach(() => {
      process.env.ENABLE_PORTION = undefined;
    });
    testPortion();
  });

  describe('with forcePortion global', () => {
    beforeEach(() => {
      process.env.ENABLE_PORTION = undefined;
      setGlobalForcePortion(true);
    });

    afterEach(() => {
      setGlobalForcePortion(false);
    });
    testPortion();
  });
});
