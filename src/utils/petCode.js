import { prisma } from '../config/prisma.js';

// Unambiguous alphabet — no 0/O/1/I/L to keep codes readable on paper.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const PREFIX = 'NP-PET-';
const LENGTH = 6;

const randomBody = () => {
  let out = '';
  for (let i = 0; i < LENGTH; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
};

/**
 * Generate a unique, human-readable pet registration code, e.g. NP-PET-7F3K9Q.
 * Retries on the (astronomically rare) collision until the code is free.
 */
export const generatePetCode = async () => {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = PREFIX + randomBody();
    const existing = await prisma.pet.findUnique({ where: { code }, select: { id: true } });
    if (!existing) return code;
  }
  // Fall back to a longer body if we somehow keep colliding.
  return PREFIX + randomBody() + randomBody();
};
