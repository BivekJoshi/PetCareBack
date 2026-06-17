import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import userRoutes from '../modules/users/user.routes.js';
import petRoutes from '../modules/pets/pet.routes.js';
import vetRoutes from '../modules/vets/vet.routes.js';
import serviceRoutes from '../modules/services/service.routes.js';
import appointmentRoutes from '../modules/appointments/appointment.routes.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ success: true, message: 'PetCare API v1', data: { status: 'ok' } });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/pets', petRoutes);
router.use('/vets', vetRoutes);
router.use('/services', serviceRoutes);
router.use('/appointments', appointmentRoutes);

export default router;
