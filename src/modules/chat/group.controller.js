import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { groupService } from './group.service.js';
import { dispatchGroupMessage, dispatchGroupUpdate } from '../../socket/index.js';

// Notify a group's members (plus any extra ids) that their group list changed.
const notify = async (groupId, extra = []) => {
  const ids = await groupService.memberIds(groupId);
  dispatchGroupUpdate([...new Set([...ids, ...extra])], groupId);
};

export const groupController = {
  create: asyncHandler(async (req, res) => {
    const group = await groupService.create(
      req.user.id,
      req.body.name,
      req.body.memberIds,
    );
    dispatchGroupUpdate(
      group.members.map((m) => m.id),
      group.id,
    );
    sendSuccess(res, { statusCode: 201, message: 'Group created', data: group });
  }),

  list: asyncHandler(async (req, res) => {
    const data = await groupService.list(req.user.id);
    sendSuccess(res, { message: 'Groups fetched', data });
  }),

  getOne: asyncHandler(async (req, res) => {
    const data = await groupService.getSummary(req.params.id, req.user.id);
    sendSuccess(res, { message: 'Group fetched', data });
  }),

  messages: asyncHandler(async (req, res) => {
    const { items, meta } = await groupService.getMessages(
      req.user.id,
      req.params.id,
      req.query,
    );
    sendSuccess(res, { message: 'Messages fetched', data: { items, meta } });
  }),

  send: asyncHandler(async (req, res) => {
    const { message, memberIds } = await groupService.createMessage(
      req.user.id,
      req.params.id,
      req.body.content,
      req.body.attachment,
      req.body.replyToId,
    );
    dispatchGroupMessage(message, memberIds);
    sendSuccess(res, { statusCode: 201, message: 'Message sent', data: message });
  }),

  members: asyncHandler(async (req, res) => {
    const data = await groupService.members(req.user.id, req.params.id);
    sendSuccess(res, { message: 'Members fetched', data });
  }),

  addMembers: asyncHandler(async (req, res) => {
    const data = await groupService.addMembers(
      req.user.id,
      req.params.id,
      req.body.memberIds,
    );
    await notify(req.params.id);
    sendSuccess(res, { message: 'Members added', data });
  }),

  removeMember: asyncHandler(async (req, res) => {
    const data = await groupService.removeMember(
      req.user.id,
      req.params.id,
      req.params.userId,
    );
    await notify(req.params.id, [req.params.userId]);
    sendSuccess(res, { message: 'Member removed', data });
  }),

  leave: asyncHandler(async (req, res) => {
    await groupService.leave(req.user.id, req.params.id);
    await notify(req.params.id, [req.user.id]);
    sendSuccess(res, { message: 'Left group' });
  }),

  rename: asyncHandler(async (req, res) => {
    const data = await groupService.rename(req.user.id, req.params.id, req.body.name);
    await notify(req.params.id);
    sendSuccess(res, { message: 'Group renamed', data });
  }),
};
