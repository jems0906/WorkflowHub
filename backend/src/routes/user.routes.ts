import { Router } from 'express';
import {
  listUsers,
  getUserById,
  updateUser,
  deleteUser,
  changePassword,
  updateUserValidation,
} from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', authorize('admin', 'reviewer'), listUsers);
router.get('/:id', getUserById);
router.put('/me/password', changePassword);
router.put('/:id', updateUserValidation, updateUser);
router.delete('/:id', authorize('admin'), deleteUser);

export default router;
