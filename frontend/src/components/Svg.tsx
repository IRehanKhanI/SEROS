import React, { forwardRef } from 'react';

export const Svg = forwardRef<SVGSVGElement, any>((props, ref) => <svg ref={ref} {...props} />);
export const Defs = (props: any) => <defs {...props} />;
export const LinearGradient = (props: any) => <linearGradient {...props} />;
export const Stop = (props: any) => <stop {...props} />;
export const G = (props: any) => <g {...props} />;
export const Line = (props: any) => <line {...props} />;
export const Circle = (props: any) => <circle {...props} />;
export const Polygon = (props: any) => <polygon {...props} />;
export const Path = (props: any) => <path {...props} />;
export const Rect = (props: any) => <rect {...props} />;
export const Text = (props: any) => <text {...props} />;
export const SvgText = Text;

export default Svg;
