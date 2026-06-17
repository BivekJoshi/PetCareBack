import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

export const hashPassword = (plain) => bcrypt.hash(plain, env.bcryptSaltRounds);

export const comparePassword = (plain, hashed) => bcrypt.compare(plain, hashed);
