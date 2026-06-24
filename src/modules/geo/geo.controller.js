import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { geoService } from './geo.service.js';

export const geoController = {
  resolveLink: asyncHandler(async (req, res) => {
    const data = await geoService.resolveMapLink(req.body.url);
    sendSuccess(res, { message: 'Coordinates resolved', data });
  }),
};
