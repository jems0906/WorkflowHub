import { Router } from 'express';
import {
  getComments,
  addComment,
  updateComment,
  deleteComment,
  commentValidation,
} from '../controllers/comment.controller';
import { authenticate } from '../middleware/auth';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', getComments);
router.post('/', commentValidation, addComment);
router.put('/:id', commentValidation, updateComment);
router.delete('/:id', deleteComment);

export default router;
