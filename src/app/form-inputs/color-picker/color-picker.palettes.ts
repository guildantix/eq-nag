import { Color } from 'src/app/utilities';

// Nag default
export const baseColors: Color[] = [
    new Color( 0, 0, 0, 1 ),new Color( 244, 67, 54, 1 ),new Color( 233, 30, 99, 1 ),new Color( 156, 39, 176, 1 ),new Color( 103, 58, 183, 1 ),new Color( 33, 150, 243, 1 ),new Color( 3, 169, 244, 1 ),new Color( 0, 188, 212, 1 ),new Color( 0, 150, 136, 1 ),new Color( 255, 235, 59, 1 ),
    new Color( 255, 255, 255, 1 ),new Color( 255, 235, 238, 1 ),new Color( 252, 228, 236, 1 ),new Color( 243, 229, 245, 1 ),new Color( 237, 231, 246, 1 ),new Color( 227, 242, 253, 1 ),new Color( 225, 245, 254, 1 ),new Color( 224, 247, 250, 1 ),new Color( 224, 242, 241, 1 ),new Color( 255, 253, 231, 1 ),
    new Color( 242, 242, 242, 1 ),new Color( 255, 205, 210, 1 ),new Color( 248, 187, 208, 1 ),new Color( 225, 190, 231, 1 ),new Color( 209, 196, 233, 1 ),new Color( 187, 222, 251, 1 ),new Color( 179, 229, 252, 1 ),new Color( 178, 235, 242, 1 ),new Color( 178, 223, 219, 1 ),new Color( 255, 249, 196, 1 ),
    new Color( 230, 230, 230, 1 ), new Color( 239, 154, 154, 1 ), new Color( 244, 143, 177, 1 ), new Color( 206, 147, 216, 1 ), new Color( 179, 157, 219, 1 ), new Color( 144, 202, 249, 1 ), new Color( 129, 212, 250, 1 ), new Color( 128, 222, 234, 1 ), new Color( 128, 203, 196, 1 ), new Color( 255, 245, 157, 1 ),
    new Color( 204, 204, 204, 1 ), new Color( 229, 115, 115, 1 ), new Color( 240, 98, 146, 1 ), new Color( 186, 104, 200, 1 ), new Color( 149, 117, 205, 1 ), new Color( 100, 181, 246, 1 ), new Color( 79, 195, 247, 1 ), new Color( 77, 208, 225, 1 ), new Color( 77, 182, 172, 1 ), new Color( 255, 241, 118, 1 ),
    new Color( 179, 179, 179, 1 ), new Color( 239, 83, 80, 1 ), new Color( 236, 64, 122, 1 ), new Color( 171, 71, 188, 1 ), new Color( 126, 87, 194, 1 ), new Color( 66, 165, 245, 1 ), new Color( 41, 182, 246, 1 ), new Color( 38, 198, 218, 1 ), new Color( 38, 166, 154, 1 ), new Color( 255, 238, 88, 1 ),
    new Color( 153, 153, 153, 1 ), new Color( 229, 57, 53, 1 ), new Color( 216, 27, 96, 1 ), new Color( 142, 36, 170, 1 ), new Color( 94, 53, 177, 1 ), new Color( 30, 136, 229, 1 ), new Color( 3, 155, 229, 1 ), new Color( 0, 172, 193, 1 ), new Color( 0, 137, 123, 1 ), new Color( 253, 216, 53, 1 ),
    new Color( 128, 128, 128, 1 ), new Color( 211, 47, 47, 1 ), new Color( 194, 24, 91, 1 ), new Color( 123, 31, 162, 1 ), new Color( 81, 45, 168, 1 ), new Color( 25, 118, 210, 1 ), new Color( 2, 136, 209, 1 ), new Color( 0, 151, 167, 1 ), new Color( 0, 121, 107, 1 ), new Color( 251, 192, 45, 1 ),
    new Color( 102, 102, 102, 1 ), new Color( 198, 40, 40, 1 ), new Color( 173, 20, 87, 1 ), new Color( 106, 27, 154, 1 ), new Color( 69, 39, 160, 1 ), new Color( 21, 101, 192, 1 ), new Color( 2, 119, 189, 1 ), new Color( 0, 131, 143, 1 ), new Color( 0, 105, 92, 1 ), new Color( 249, 168, 37, 1 ),
    new Color( 77, 77, 77, 1 ), new Color( 183, 28, 28, 1 ), new Color( 136, 14, 79, 1 ), new Color( 74, 20, 140, 1 ), new Color( 49, 27, 146, 1 ), new Color( 13, 71, 161, 1 ), new Color( 1, 87, 155, 1 ), new Color( 0, 96, 100, 1 ), new Color( 0, 77, 64, 1 ), new Color( 245, 127, 23, 1 ),
];

// Gina default
export const ginaColors: Color[] = [
    new Color( 255, 255, 255 ), new Color( 128, 128, 128 ), new Color( 0, 0, 0 ), new Color( 255, 0, 0 ), new Color( 0, 128, 0 ), new Color( 0, 255, 0 ), new Color( 0, 0, 255 ), new Color( 255, 255, 0 ), new Color( 255, 165, 0 ), new Color( 128, 0, 128 )
];


// Some nice glows
export const glowDarkColors = [
    // DARKER - Deep saturated colors with punch
    new Color(139, 0, 139),    // Dark Magenta
    new Color(178, 34, 34),    // Fire Brick Red
    new Color(205, 92, 92),    // Indian Red
    new Color(184, 134, 11),   // Dark Goldenrod
    new Color(85, 107, 47),    // Dark Olive Green
    new Color(0, 100, 0),      // Dark Green
    new Color(25, 25, 112),    // Midnight Blue
    new Color(72, 61, 139),    // Dark Slate Blue
    new Color(75, 0, 130),     // Indigo
    new Color(128, 0, 128)     // Purple
];

export const glowMediumColors = [
    // MEDIUM - Pure saturated neon colors
    new Color(255, 20, 147),   // Neon Pink
    new Color(255, 0, 64),     // Electric Red
    new Color(255, 69, 0),     // Neon Orange
    new Color(255, 215, 0),    // Electric Gold
    new Color(127, 255, 0),    // Chartreuse
    new Color(0, 255, 127),    // Spring Green
    new Color(0, 191, 255),    // Deep Sky Blue
    new Color(75, 0, 255),     // Electric Indigo
    new Color(148, 0, 211),    // Dark Violet
    new Color(255, 0, 128)     // Electric Rose
];

export const glowBrightColors = [
    // BRIGHT - Maximum pop, almost glowing whites with color tints
    new Color(255, 128, 255),  // Bright Electric Pink
    new Color(255, 64, 64),    // Bright Electric Red
    new Color(255, 128, 32),   // Bright Electric Orange
    new Color(255, 255, 64),   // Bright Electric Yellow
    new Color(128, 255, 64),   // Bright Electric Lime
    new Color(64, 255, 128),   // Bright Electric Green
    new Color(64, 255, 255),   // Bright Electric Cyan
    new Color(128, 128, 255),  // Bright Electric Blue
    new Color(192, 64, 255),   // Bright Electric Purple
    new Color(255, 64, 192)    // Bright Electric Magenta
];

export const glowVeryBrightColors = [
    // VERY BRIGHT - Almost white with a hint of color
    new Color(255, 192, 250),  // Pastel Hot Pink
    new Color(255, 160, 160),  // Fluorescent Neon Coral
    new Color(255, 206, 140),  // Creamy Neon Orange
    new Color(255, 255, 170),  // Extra Soft
    new Color(210, 255, 150),  // Lime Sorbet
    new Color(200, 255, 200),  // Pastel Mint Glow
    new Color(190, 255, 245),  // Gossamer Aqua Glow
    new Color(200, 230, 255),  // Cloud Blue Glow
    new Color(225, 200, 255),  // Lavender Mist Glow
    new Color(255, 205, 240)   // Baby Pink Glow
];

export const forestColors = [
    // Forest Theme - Earthy greens, browns, mosses
    new Color(34, 45, 23), new Color(47, 63, 25), new Color(53, 87, 34), new Color(86, 121, 56), new Color(112, 153, 70),
    new Color(145, 190, 85), new Color(167, 202, 104), new Color(98, 128, 63), new Color(75, 105, 45), new Color(49, 61, 28),
    new Color(95, 73, 44), new Color(110, 88, 48), new Color(132, 105, 60), new Color(156, 132, 78), new Color(179, 161, 95),
    new Color(100, 70, 50), new Color(68, 44, 30), new Color(46, 30, 20), new Color(29, 20, 11), new Color(18, 13, 7)
];

export const oceanColors = [
    // Ocean Theme - Blues, cyans, teals
    new Color(0, 51, 102), new Color(0, 74, 139), new Color(0, 102, 153), new Color(0, 127, 163), new Color(0, 153, 178),
    new Color(28, 179, 170), new Color(57, 204, 186), new Color(86, 229, 209), new Color(115, 255, 232), new Color(145, 255, 243),
    new Color(117, 197, 224), new Color(86, 150, 189), new Color(57, 110, 161), new Color(28, 74, 140), new Color(0, 44, 114),
    new Color(69, 167, 214), new Color(101, 197, 239), new Color(134, 227, 255), new Color(166, 255, 254), new Color(198, 255, 254)
];

export const spaceColors = [
    // Space Theme - Dark blues, purples, deep grays, cosmic blacks
    new Color(18, 18, 36), new Color(24, 25, 56), new Color(29, 30, 71), new Color(37, 31, 90), new Color(47, 41, 123),
    new Color(56, 52, 138), new Color(68, 48, 164), new Color(79, 55, 200), new Color(95, 71, 210), new Color(112, 90, 218),
    new Color(55, 40, 70), new Color(68, 54, 90), new Color(82, 65, 107), new Color(95, 75, 128), new Color(115, 95, 153),
    new Color(130, 119, 175), new Color(148, 141, 198), new Color(166, 165, 220), new Color(185, 189, 242), new Color(204, 213, 255)
];

export const iceColors = [
    // Ice Theme - Light blues, whites, pale blues, frost tones
    new Color(208, 230, 247), new Color(192, 218, 237), new Color(178, 204, 230), new Color(163, 191, 222), new Color(150, 182, 214),
    new Color(138, 174, 207), new Color(130, 166, 201), new Color(120, 160, 196), new Color(112, 155, 190), new Color(105, 150, 185),
    new Color(235, 245, 250), new Color(240, 248, 255), new Color(245, 250, 255), new Color(250, 252, 255), new Color(255, 255, 255),
    new Color(225, 235, 245), new Color(210, 225, 230), new Color(195, 215, 220), new Color(185, 210, 213), new Color(172, 200, 205)
];

export const sunsetColors = [
    // Sunset Theme - Oranges, reds, warm yellows, pinks
    new Color(204, 51, 0), new Color(217, 67, 15), new Color(230, 83, 30), new Color(243, 99, 45), new Color(255, 115, 60),
    new Color(255, 140, 80), new Color(255, 165, 105), new Color(255, 190, 130), new Color(255, 215, 155), new Color(255, 240, 180),
    new Color(192, 30, 45), new Color(210, 50, 70), new Color(228, 70, 95), new Color(245, 90, 120), new Color(255, 110, 150),
    new Color(255, 135, 180), new Color(255, 160, 210), new Color(255, 185, 240), new Color(255, 210, 255), new Color(255, 235, 255)
];

export const pastelColors = [
    // Pastel Theme - Soft muted pinks, blues, greens, lavenders
    new Color(255, 204, 204), new Color(255, 229, 204), new Color(255, 255, 204), new Color(229, 255, 204), new Color(204, 255, 204),
    new Color(204, 255, 229), new Color(204, 255, 255), new Color(204, 229, 255), new Color(204, 204, 255), new Color(229, 204, 255),
    new Color(255, 204, 255), new Color(255, 204, 229), new Color(255, 218, 218), new Color(255, 230, 218), new Color(255, 242, 218),
    new Color(230, 255, 218), new Color(218, 255, 230), new Color(218, 255, 242), new Color(218, 230, 255), new Color(230, 218, 255)
];


export const darkMidDarkColors = [
    new Color(44, 34, 54),    // near-black plum
    new Color(34, 54, 44),    // dark pine
    new Color(32, 40, 85),    // deep navy blue
    new Color(45, 41, 60),    // dark purple gray
    new Color(53, 34, 25),    // chocolate brown
    new Color(55, 44, 32),    // olive brown
    new Color(44, 47, 66),    // blue-gray
    new Color(32, 58, 65),    // dark teal
    new Color(39, 54, 22),    // deep olive green
    new Color(49, 19, 56),    // black grape

    new Color(86, 7, 12),     // oxblood dark red
    new Color(90, 33, 5),     // burnt ochre
    new Color(64, 45, 15),    // dark walnut
    new Color(25, 55, 22),    // forest green
    new Color(8, 52, 74),     // midnight blue
    new Color(41, 12, 84),    // deep indigo
    new Color(53, 18, 46),    // dark mulberry
    new Color(71, 0, 68),     // dark purple
    new Color(91, 60, 17),    // dark amber
    new Color(54, 48, 17),    // army olive

    new Color(104, 34, 90),   // eggplant
    new Color(36, 54, 94),    // blue lapis
    new Color(22, 83, 93),    // teal
    new Color(20, 92, 58),    // pine green
    new Color(94, 70, 16),    // caramel gold
    new Color(92, 46, 27),    // tuscan brown
    new Color(93, 27, 53),    // deep rosebud
    new Color(74, 29, 93),    // deep violet
    new Color(73, 41, 94),    // amethyst
    new Color(36, 36, 99)     // sapphire
];

export const midMediumBrightColors = [
    new Color(139, 39, 50),   // wine
    new Color(137, 57, 17),   // burnt sienna
    new Color(123, 102, 19),  // mustard dark
    new Color(63, 136, 48),   // deep moss
    new Color(35, 113, 119),  // prussian blue
    new Color(56, 85, 136),   // steel blue
    new Color(89, 67, 137),   // wisteria
    new Color(120, 57, 137),  // deep lavender
    new Color(135, 57, 109),  // berry
    new Color(137, 72, 109),  // muted magenta

    new Color(166, 54, 68),   // mahogany
    new Color(154, 88, 38),   // warm ochre
    new Color(142, 128, 44),  // olive ochre
    new Color(92, 162, 68),   // grassy green
    new Color(44, 157, 131),  // pine
    new Color(82, 152, 168),  // petrol blue
    new Color(89, 126, 195),  // muted blue
    new Color(137, 102, 188), // plum
    new Color(170, 92, 165),  // muted orchid
    new Color(195, 82, 121),  // dusty rose

    new Color(220, 75, 108),  // bright cerise
    new Color(237, 134, 46),  // tangerine
    new Color(213, 179, 39),  // sunflower mustard
    new Color(142, 227, 61),  // lime green
    new Color(62, 231, 113),  // vivid spring green
    new Color(55, 206, 186),  // light teal green
    new Color(66, 183, 251),  // bright blue
    new Color(153, 121, 250), // medium periwinkle
    new Color(208, 89, 238),  // purple magenta
    new Color(238, 86, 200)   // hot pink
];

export const brightPaleColors = [
    new Color(239, 143, 161), // muted coral
    new Color(244, 199, 85),  // light gold
    new Color(227, 227, 60),  // pastel lemon
    new Color(114, 251, 170), // pastel green
    new Color(77, 210, 223),  // light cyan
    new Color(104, 201, 251), // pastel blue
    new Color(183, 165, 251), // pastel lavender
    new Color(238, 117, 238), // pastel magenta
    new Color(251, 172, 199), // light flamingo
    new Color(251, 144, 183), // dusty blush

    new Color(246, 197, 204), // pale pink
    new Color(247, 232, 183), // light cream
    new Color(233, 247, 183), // light green yellow
    new Color(192, 249, 201), // light mint
    new Color(183, 247, 233), // pastel aqua
    new Color(199, 243, 255), // frosty blue
    new Color(223, 207, 250), // soft violet
    new Color(250, 207, 234), // pale mauve
    new Color(250, 220, 207), // pale peach
    new Color(250, 241, 207), // pale butter

    new Color(255, 228, 239), // blush pink
    new Color(253, 247, 137), // delicate yellow
    new Color(233, 253, 247), // white teal
    new Color(241, 253, 233), // white green
    new Color(221, 253, 255), // white blue
    new Color(251, 233, 255), // white purple
    new Color(255, 220, 241), // white rose
    new Color(229, 255, 244), // white spring
    new Color(255, 250, 220), // white almond
    new Color(255, 253, 233)  // white cream
];

export const vaporwaveColors = [
    new Color(250, 62, 255),   // Vibrant magenta
    new Color(93, 80, 255),    // Retro purple-blue
    new Color(28, 213, 255),   // Cyan sky
    new Color(255, 255, 128),  // Acid yellow
    new Color(255, 144, 255),  // Light pink
    new Color(187, 255, 221),  // Mint foam
    new Color(255, 85, 85),    // Brash red
    new Color(51, 255, 195),   // Neon teal
    new Color(242, 117, 255),  // Pastel magenta
    new Color(255, 255, 255),  // White (for grid lines and highlight)
];

export const windowsXpColors = [
    new Color(0, 78, 152),      // XP Default Desktop Blue (#004E98)[3]
    new Color(59, 119, 188),    // XP Start Menu Blue (#3B77BC)[10]
    new Color(129, 192, 70),    // XP Green Button/Bud Green (#81C046)[10]
    new Color(255, 207, 3),     // XP Taskbar Highlight/Yellow (#FCCF03)[10]
    new Color(222, 72, 43),     // XP Accent Red/Cinnabar (#DE482B)[10]
    new Color(237, 227, 200),   // XP Silver Panel/Beige
    new Color(187, 191, 201),   // XP Silver Frame
    new Color(238, 216, 66),    // XP Folders/Accent Yellow (#eed842)[4]
    new Color(100, 162, 216),   // XP Sky Blue (#64a2d8)[4]
    new Color(125, 195, 67),    // XP Green Variant (#7dc343)[4]
    new Color(236, 114, 46),    // XP Orange Accent (#ec722e)[4]
    new Color(0, 0, 0),         // Black
    new Color(255, 255, 255),   // White
    new Color(107, 217, 250),   // XP Highlight Blue
    new Color(126, 139, 163),   // XP Disabled Button Gray
    new Color(93, 26, 255),     // XP Fun Blue Accent (#5b1aff)[7]
    new Color(134, 249, 116),   // XP Fun Green (#86f974)[7]
    new Color(251, 160, 20),    // XP Fun Orange (#fba014)[7]
    new Color(224, 251, 7),     // XP Lime (#e0fb07)[7]
    new Color(15, 135, 246)     // XP Cyan (#0f87f6)[7]
];




// Collections
export const palette01 = [...forestColors, ...oceanColors, ...spaceColors, ...iceColors, ...sunsetColors, ...pastelColors];
export const palette02 = [...darkMidDarkColors, ...midMediumBrightColors, ...brightPaleColors];
export const palette03 = [...glowDarkColors, ...glowMediumColors, ...glowBrightColors, ...glowVeryBrightColors];
export const palette04 = [...vaporwaveColors, ...windowsXpColors];
export const palette05 = [...baseColors];
