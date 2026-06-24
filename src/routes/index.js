import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import userRoutes from '../modules/users/user.routes.js';
import petRoutes from '../modules/pets/pet.routes.js';
import vetRoutes from '../modules/vets/vet.routes.js';
import serviceRoutes from '../modules/services/service.routes.js';
import appointmentRoutes from '../modules/appointments/appointment.routes.js';
import vaccinationRoutes from '../modules/vaccinations/vaccination.routes.js';
import recordRoutes from '../modules/records/record.routes.js';
import reminderRoutes from '../modules/reminders/reminder.routes.js';
import areaRoutes from '../modules/areas/area.routes.js';
import statsRoutes from '../modules/stats/stats.routes.js';
import chatRoutes from '../modules/chat/chat.routes.js';
import adminRoutes from '../modules/admin/admin.routes.js';
import emailTemplateRoutes from '../modules/emailTemplates/emailTemplate.routes.js';
import roleRequestRoutes from '../modules/roleRequests/role-request.routes.js';
import speciesRoutes from '../modules/species/species.routes.js';
import geoRoutes from '../modules/geo/geo.routes.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ success: true, message: 'PetCare API v1', data: { status: 'ok' } });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/role-requests', roleRequestRoutes);
router.use('/pets', petRoutes);
router.use('/species', speciesRoutes);
router.use('/vets', vetRoutes);
router.use('/services', serviceRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/vaccinations', vaccinationRoutes);
router.use('/records', recordRoutes);
router.use('/reminders', reminderRoutes);
router.use('/areas', areaRoutes);
router.use('/geo', geoRoutes);
router.use('/stats', statsRoutes);
router.use('/chat', chatRoutes);
router.use('/admin', adminRoutes);
router.use('/email-templates', emailTemplateRoutes);

export default router;
