import React from 'react';
import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import { DS } from '../../Theme';

/**
 * ----------------------------------------------------------------------
 * 🔮 THE STATE LAYER (Interactive Soul of the UI)
 * ----------------------------------------------------------------------
 *
 * 🟢 WHAT IS IT? (TLDR)
 * It's a shape-shifting invisible ghost that sits on top of interactive elements.
 * When you touch it, it wakes up, turns into a circle, and grows.
 *
 * 🔵 HOW DOES IT WORK? (Plain English)
 * 1. It sits absolutely positioned inside the parent (Button).
 * 2. It tracks your mouse/finger coordinates (x, y) passed down from the parent.
 * 3. When the parent says "I'm active" (hover/press), this layer expands from that exact point.
 * 4. It fills the button with a subtle tint, respecting the parent's boundaries.
 * ----------------------------------------------------------------------
 */

interface StateLayerProps {
    color?: string;
    isActive: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
}

export const StateLayer: React.FC<StateLayerProps> = ({ color, isActive, x, y, width, height }) => {
    // Secret #1: Calculate the diameter needed to cover the button from any point
    // We multiply by 2 to ensure the radius reaches the furthest corner relative to the cursor
    const maxDiameter = Math.hypot(width, height) * 2;

    const layerStyle: CSSProperties = {
        position: 'absolute',
        top: y,
        left: x,
        backgroundColor: color || DS.Color.Base.Content[1],
        borderRadius: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none', // Secret #2: Pass clicks through to the button
        zIndex: 0, // Sit behind content
        opacity: 0.1, // Visual rule: 10% opacity for state layer
    };

    return (
        <motion.div
            style={layerStyle}
            initial={false}
            animate={{
                width: isActive ? maxDiameter : 0,
                height: isActive ? maxDiameter : 0,
            }}
            transition={{
                type: 'spring',
                stiffness: 100,
                damping: 20,
                mass: 1,
            }}
        />
    );
};