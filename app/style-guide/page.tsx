'use client';

import React from 'react';
import CtaButton from '@/components/shared/CtaButton';
import styles from './page.module.css';
import {
  colors,
  fontFamilies,
  fontSizes,
  typography,
  spacing,
  borderRadius,
  breakpoints,
  durations,
  zIndex,
} from '@/styles/design-tokens';

// Import actual components from codebase
import Banner from '@/components/banner/Banner';
import { SoulGemDisplay } from '@/components/soul-gems/SoulGemDisplay';
import ProposalStages from '@/components/proposal-stages/ProposalStages';
import CourseFolderCard from '@/components/home/CourseFolderCard';
import BlueDialogue from '@/components/blue-dialogue/BlueDialogue';
import {
  MagnifyingGlass,
  Plus,
  X,
  Check,
  CheckCircle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  ArrowsClockwise,
  CaretDown,
  CaretUp,
  Bell,
  Lock,
  Key,
  Copy,
  Trash,
  PencilSimple,
  Sparkle,
  Shield,
  Coins,
  Medal,
  Cube,
  GridFour,
  Rows,
  Clock,
  ChatCircle,
  Eye,
  Robot,
  Path,
  SealCheck,
  Paperclip,
} from '@phosphor-icons/react';

/**
 * Mental Wealth Academy Style Guide
 * Visual reference for all design tokens
 */
export default function StyleGuidePage() {
  const [blueOpen, setBlueOpen] = React.useState(false);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Header */}
        <header className={styles.header}>
          <h1 className={styles.title}>Design System</h1>
          <p className={styles.subtitle}>
            Mental Wealth Academy — Visual reference for design tokens and components
          </p>
        </header>

        {/* Colors Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Colors</h2>
          <p className={styles.sectionDescription}>
            Our color palette is rooted in knowledge, community, and transparency. 
            Academy Blue signals trust and primary actions, while Growth Green signals progress and achievements.
          </p>

          {/* Primary Colors */}
          <div className={styles.subsection}>
            <h3 className={styles.subsectionTitle}>Primary Colors</h3>
            <div className={styles.colorGrid}>
              <ColorCard name="Primary" value={colors.primary.DEFAULT} />
              <ColorCard name="Primary Hover" value={colors.primary.hover} />
              <ColorCard name="Primary Light" value={colors.primary.light} />
              <ColorCard name="Secondary" value={colors.secondary.DEFAULT} />
              <ColorCard name="Secondary Hover" value={colors.secondary.hover} />
              <ColorCard name="Secondary Light" value={colors.secondary.light} />
            </div>
          </div>

          {/* Background Colors */}
          <div className={styles.subsection}>
            <h3 className={styles.subsectionTitle}>Background Colors</h3>
            <div className={styles.colorGrid}>
              <ColorCard name="Background" value={colors.background.DEFAULT} />
              <ColorCard name="Card" value="#FFFFFF" />
              <ColorCard name="Dark Background" value={colors.background.dark} />
              <ColorCard name="Dark Card" value={colors.background.cardDark} />
            </div>
          </div>

          {/* Neutral Colors */}
          <div className={styles.subsection}>
            <h3 className={styles.subsectionTitle}>Neutral Scale</h3>
            <div className={styles.colorGrid}>
              <ColorCard name="White" value={colors.neutrals.white} />
              <ColorCard name="Gray 50" value={colors.neutrals[50]} />
              <ColorCard name="Gray 100" value={colors.neutrals[100]} />
              <ColorCard name="Gray 200" value={colors.neutrals[200]} />
              <ColorCard name="Gray 300" value={colors.neutrals[300]} />
              <ColorCard name="Gray 400" value={colors.neutrals[400]} />
              <ColorCard name="Gray 500" value={colors.neutrals[500]} />
              <ColorCard name="Gray 600" value={colors.neutrals[600]} />
              <ColorCard name="Gray 700" value={colors.neutrals[700]} />
              <ColorCard name="Gray 800" value={colors.neutrals[800]} />
              <ColorCard name="Gray 900" value={colors.neutrals[900]} />
              <ColorCard name="Black" value={colors.neutrals.black} />
            </div>
          </div>

          {/* Semantic Colors */}
          <div className={styles.subsection}>
            <h3 className={styles.subsectionTitle}>Semantic Colors</h3>
            <div className={styles.colorGrid}>
              <ColorCard name="Success" value={colors.semantic.success.DEFAULT} />
              <ColorCard name="Success Light" value={colors.semantic.success.light} />
              <ColorCard name="Warning" value={colors.semantic.warning.DEFAULT} />
              <ColorCard name="Warning Light" value={colors.semantic.warning.light} />
              <ColorCard name="Error" value={colors.semantic.error.DEFAULT} />
              <ColorCard name="Error Light" value={colors.semantic.error.light} />
              <ColorCard name="Info" value={colors.semantic.info.DEFAULT} />
              <ColorCard name="Info Light" value={colors.semantic.info.light} />
            </div>
          </div>

          {/* Category Colors */}
          <div className={styles.subsection}>
            <h3 className={styles.subsectionTitle}>Category Colors</h3>
            <div className={styles.colorGrid}>
              <ColorCard name="Productivity" value={colors.category.productivity} />
              <ColorCard name="Wealth" value={colors.category.wealth} />
            </div>
          </div>
        </section>

        {/* Typography Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Typography</h2>
          <p className={styles.sectionDescription}>
            Typography sets the tone for knowledge transfer and community trust.
            Space Grotesk for headlines, Poppins for body text, and Space Grotesk for buttons and technical data.
          </p>

          {/* Font Families */}
          <div className={styles.subsection}>
            <h3 className={styles.subsectionTitle}>Font Families</h3>
            <div className={styles.fontFamilyGrid}>
              <div className={styles.fontFamilyCard}>
                <div className={styles.fontFamilyName} style={{ fontFamily: fontFamilies.primary }}>
                  Poppins
                </div>
                <div className={styles.fontFamilyUsage}>Primary — Body Text</div>
                <div className={styles.fontFamilySample} style={{ fontFamily: fontFamilies.primary, fontWeight: 300 }}>
                  The quick brown fox jumps over the lazy dog.
                </div>
                <div className={styles.fontWeightsRow}>
                  <span className={styles.fontWeightChip} style={{ fontFamily: fontFamilies.primary, fontWeight: 300 }}>Light 300</span>
                  <span className={styles.fontWeightChip} style={{ fontFamily: fontFamilies.primary, fontWeight: 400 }}>Regular 400</span>
                  <span className={styles.fontWeightChip} style={{ fontFamily: fontFamilies.primary, fontWeight: 500 }}>Medium 500</span>
                  <span className={styles.fontWeightChip} style={{ fontFamily: fontFamilies.primary, fontWeight: 600 }}>Semibold 600</span>
                  <span className={styles.fontWeightChip} style={{ fontFamily: fontFamilies.primary, fontWeight: 700 }}>Bold 700</span>
                </div>
              </div>
              <div className={styles.fontFamilyCard}>
                <div className={styles.fontFamilyName} style={{ fontFamily: fontFamilies.secondary }}>
                  Space Grotesk
                </div>
                <div className={styles.fontFamilyUsage}>Secondary — Headlines, Navigation</div>
                <div className={styles.fontFamilySample} style={{ fontFamily: fontFamilies.secondary }}>
                  The quick brown fox jumps over the lazy dog.
                </div>
                <div className={styles.fontWeightsRow}>
                  <span className={styles.fontWeightChip} style={{ fontFamily: fontFamilies.secondary, fontWeight: 400 }}>Regular 400</span>
                  <span className={styles.fontWeightChip} style={{ fontFamily: fontFamilies.secondary, fontWeight: 500 }}>Medium 500</span>
                  <span className={styles.fontWeightChip} style={{ fontFamily: fontFamilies.secondary, fontWeight: 600 }}>Semibold 600</span>
                  <span className={styles.fontWeightChip} style={{ fontFamily: fontFamilies.secondary, fontWeight: 700 }}>Bold 700</span>
                </div>
              </div>
              <div className={styles.fontFamilyCard}>
                <div className={styles.fontFamilyName} style={{ fontFamily: fontFamilies.mono }}>
                  Space Grotesk
                </div>
                <div className={styles.fontFamilyUsage}>Mono — Buttons, Code, Technical Data</div>
                <div className={styles.fontFamilySample} style={{ fontFamily: fontFamilies.mono }}>
                  0x1234...5678 | $42,069.00
                </div>
                <div className={styles.fontWeightsRow}>
                  <span className={styles.fontWeightChip} style={{ fontFamily: fontFamilies.mono, fontWeight: 400 }}>Regular 400</span>
                  <span className={styles.fontWeightChip} style={{ fontFamily: fontFamilies.mono, fontWeight: 500 }}>Medium 500</span>
                  <span className={styles.fontWeightChip} style={{ fontFamily: fontFamilies.mono, fontWeight: 600 }}>Semibold 600</span>
                  <span className={styles.fontWeightChip} style={{ fontFamily: fontFamilies.mono, fontWeight: 700 }}>Bold 700</span>
                </div>
              </div>
            </div>
          </div>

          {/* Type Scale */}
          <div className={styles.subsection}>
            <h3 className={styles.subsectionTitle}>Type Scale</h3>
            <div className={styles.typographyGrid}>
              <TypographySample 
                label="H1 — Hero Headlines" 
                text="Mental Wealth Academy" 
                style={{ ...typography.h1, fontSize: fontSizes['3xl'] }}
                meta={`${fontSizes['3xl']} / Bold / Space Grotesk`}
              />
              <TypographySample 
                label="H2 — Page Titles" 
                text="Building Transparent Futures" 
                style={{ ...typography.h2, fontSize: fontSizes['2xl'] }}
                meta={`${fontSizes['2xl']} / Semibold / Space Grotesk`}
              />
              <TypographySample 
                label="H3 — Section Headers" 
                text="Education That Empowers" 
                style={{ ...typography.h3, fontSize: fontSizes.xl }}
                meta={`${fontSizes.xl} / Semibold / Space Grotesk`}
              />
              <TypographySample 
                label="H4 — Subheadings" 
                text="Community Governance" 
                style={{ ...typography.h4, fontSize: fontSizes.lg }}
                meta={`${fontSizes.lg} / Semibold / Space Grotesk`}
              />
              <TypographySample 
                label="Body — Primary Text" 
                text="Our design is educational, community-centered, transparent, accessible, empowering, collaborative, and forward-thinking." 
                style={{ ...typography.body, fontSize: fontSizes.base }}
                meta={`${fontSizes.base} / Light / Poppins`}
              />
              <TypographySample 
                label="Body Large — Featured Text" 
                text="Knowledge for all, together. Growing stronger by empowering your community." 
                style={{ ...typography.bodyLarge, fontSize: fontSizes.md }}
                meta={`${fontSizes.md} / Light / Poppins`}
              />
              <TypographySample 
                label="Caption — Metadata" 
                text="Last updated 2 hours ago • 1.2k views • 48 comments" 
                style={{ ...typography.caption, fontSize: fontSizes.xs }}
                meta={`${fontSizes.xs} / Regular / Poppins`}
              />
              <TypographySample
                label="Button — Actions"
                text="Connect wallet"
                style={{ ...typography.button, fontSize: fontSizes.base, textTransform: 'none' }}
                meta={`${fontSizes.base} / Medium / Space Grotesk / Sentence case`}
              />
              <TypographySample 
                label="Mono — Technical Data" 
                text="0x1234...5678 | Block #18,942,156" 
                style={{ ...typography.mono, fontSize: fontSizes.base }}
                meta={`${fontSizes.base} / Regular / Space Grotesk / Tabular Nums`}
              />
            </div>
          </div>
        </section>

        {/* Spacing Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Spacing Scale</h2>
          <p className={styles.sectionDescription}>
            All spacing uses a 4px base grid for precision and rhythm. Compatible with Tailwind spacing utilities.
          </p>
          <div className={styles.spacingGrid}>
            {[
              { key: '1', value: spacing[1], px: '4px' },
              { key: '2', value: spacing[2], px: '8px' },
              { key: '3', value: spacing[3], px: '12px' },
              { key: '4', value: spacing[4], px: '16px' },
              { key: '5', value: spacing[5], px: '20px' },
              { key: '6', value: spacing[6], px: '24px' },
              { key: '8', value: spacing[8], px: '32px' },
              { key: '10', value: spacing[10], px: '40px' },
              { key: '12', value: spacing[12], px: '48px' },
              { key: '16', value: spacing[16], px: '64px' },
              { key: '20', value: spacing[20], px: '80px' },
              { key: '24', value: spacing[24], px: '96px' },
            ].map((s) => (
              <div key={s.key} className={styles.spacingRow}>
                <span className={styles.spacingLabel}>{s.key}</span>
                <div 
                  className={styles.spacingBar} 
                  style={{ width: `calc(${s.value} * 3)` }}
                >
                  <span className={styles.spacingValue}>{s.px}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Border Radius Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Border Radius</h2>
          <p className={styles.sectionDescription}>
            Soft corners to balance technical precision with approachability. Stick to the 4px grid.
          </p>
          <div className={styles.radiusGrid}>
            {Object.entries(borderRadius).map(([key, value]) => (
              <div key={key} className={styles.radiusCard} style={{ borderRadius: value }}>
                <div 
                  className={styles.radiusSample} 
                  style={{ borderRadius: value }}
                />
                <span className={styles.radiusLabel}>{key}</span>
                <span className={styles.radiusValue}>{value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Shadows Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Shadows</h2>
          <p className={styles.sectionDescription}>
            The four drop-shadow treatments actually in use across the top nav and home bento. Pick the one that matches the surface, not an arbitrary blur value.
          </p>
          <div className={styles.shadowGrid}>
            <div className={styles.shadowCard} style={{ boxShadow: '0 22px 50px rgba(26, 29, 51, 0.1)', border: '1px solid color-mix(in oklch, var(--color-primary) 18%, transparent)' }}>
              <span className={styles.shadowLabel}>Soft Elevated</span>
              <span className={styles.shadowMeta}>Home gate/modal cards</span>
            </div>
            <div className={styles.shadowCard} style={{ boxShadow: '0 6px 0 var(--color-primary), 0 0px 10px rgba(0, 0, 0, 0.14)', border: '2px solid var(--color-primary-hover)' }}>
              <span className={styles.shadowLabel}>Comic Offset</span>
              <span className={styles.shadowMeta}>/home course cards</span>
            </div>
            <div className={styles.shadowCard} style={{ boxShadow: '0 3px 0 color-mix(in oklch, var(--color-primary) 25%, transparent)', border: '1.5px solid color-mix(in oklch, var(--color-primary) 30%, transparent)' }}>
              <span className={styles.shadowLabel}>Pill Offset</span>
              <span className={styles.shadowMeta}>Top nav search &amp; links</span>
            </div>
            <div className={styles.shadowCard} style={{ boxShadow: '0 2px 8px rgba(26, 29, 51, 0.04)', border: '1px solid rgba(26, 29, 51, 0.06)' }}>
              <span className={styles.shadowLabel}>Subtle Hover</span>
              <span className={styles.shadowMeta}>/course-builder component rows</span>
            </div>
          </div>
        </section>

        {/* Breakpoints Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Breakpoints</h2>
          <p className={styles.sectionDescription}>
            Mobile-first responsive design breakpoints. Design for the smallest screen first.
          </p>
          <div className={styles.breakpointGrid}>
            {[
              { name: 'xs', value: breakpoints.xs, device: 'Small phones', percent: 20 },
              { name: 'sm', value: breakpoints.sm, device: 'Large phones', percent: 30 },
              { name: 'md', value: breakpoints.md, device: 'Tablets', percent: 50 },
              { name: 'lg', value: breakpoints.lg, device: 'Laptops', percent: 67 },
              { name: 'xl', value: breakpoints.xl, device: 'Desktops', percent: 83 },
              { name: '2xl', value: breakpoints['2xl'], device: 'Large desktops', percent: 100 },
            ].map((bp) => (
              <div key={bp.name} className={styles.breakpointRow}>
                <span className={styles.breakpointName}>{bp.name}</span>
                <span className={styles.breakpointValue}>{bp.value}</span>
                <div className={styles.breakpointBar}>
                  <div 
                    className={styles.breakpointFill}
                    style={{ width: `${bp.percent}%` }}
                  />
                </div>
                <span className={styles.breakpointDevice}>{bp.device}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Animation Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Animation</h2>
          <p className={styles.sectionDescription}>
            Smooth, decisive animations that respect user focus. No spring/bouncy effects in enterprise UI.
          </p>

          <div className={styles.subsection}>
            <h3 className={styles.subsectionTitle}>Durations</h3>
            <div className={styles.animationGrid}>
              {Object.entries(durations).map(([key, value]) => (
                <div key={key} className={styles.animationCard}>
                  <div 
                    className={styles.animationBox}
                    style={{ transition: `transform ${value} ease` }}
                  />
                  <span className={styles.animationLabel}>{key}</span>
                  <span className={styles.animationValue}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Z-Index Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Z-Index Scale</h2>
          <p className={styles.sectionDescription}>
            Layering system for managing stacking contexts consistently across components.
          </p>
          <div className={styles.zIndexGrid}>
            {Object.entries(zIndex)
              .filter(([, value]) => typeof value === 'number')
              .sort(([, a], [, b]) => (a as number) - (b as number))
              .map(([key, value]) => (
                <div key={key} className={styles.zIndexRow}>
                  <span className={styles.zIndexLabel}>{key}</span>
                  <span className={styles.zIndexValue}>{value}</span>
                </div>
              ))}
          </div>
        </section>

        {/* Buttons Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Buttons</h2>
          <p className={styles.sectionDescription}>
            Canonical call-to-action. Reach for the shared <code>&lt;CtaButton&gt;</code> for any
            primary action instead of hand-rolling one. Pill shaped, brand blue, Space Grotesk,
            sentence case (never uppercase), with a soft lift and glow on hover.
          </p>
          <div className={styles.buttonGrid}>
            <CtaButton variant="primary">Ask Blue</CtaButton>
            <CtaButton variant="secondary">Secondary action</CtaButton>
            <CtaButton variant="ghost">Ghost action</CtaButton>
          </div>
          <div className={styles.buttonGrid} style={{ marginTop: '1rem' }}>
            <CtaButton variant="primary" size="sm">Small</CtaButton>
            <CtaButton variant="primary">Medium</CtaButton>
            <CtaButton variant="primary" size="lg">Large</CtaButton>
            <CtaButton variant="primary" disabled>Disabled</CtaButton>
          </div>

          <div className={styles.subsection} style={{ marginTop: '2rem' }}>
            <h3 className={styles.subsectionTitle}>Top Nav Pills</h3>
            <p className={styles.sectionDescription}>
              Nav links use a chunkier pill with a flat color offset instead of a blurred shadow — the same 3px-drop language as the top nav search bar.
            </p>
            <div className={styles.buttonGrid}>
              <button className={styles.topNavPill}>Courses</button>
              <button className={`${styles.topNavPill} ${styles.topNavPillActive}`}>Home</button>
              <button className={styles.topNavPill} disabled>Locked</button>
            </div>
          </div>
        </section>

        {/* Cards Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Cards</h2>
          <p className={styles.sectionDescription}>
            Two surfaces cover almost every card in the app: the folder-style course card from <code>/home</code> (the live <code>CourseFolderCard</code> component), and the flatter drag-and-drop row from <code>/course-builder</code>.
          </p>
          <div className={styles.cardGrid}>
            <div className={styles.folderCardDemo}>
              <CourseFolderCard
                title="Shadow Work"
                count={12}
                images={[]}
                ctaLabel="Start Course"
              />
            </div>
            <div className={styles.taskCardDemo}>
              <span className={styles.taskCardDemoHandle}>⠿</span>
              <span className={styles.taskCardDemoAccent} />
              <div className={styles.taskCardDemoArtwork} />
              <div className={styles.taskCardDemoInfo}>
                <span className={styles.taskCardDemoType}>Reading</span>
                <span className={styles.taskCardDemoTitle}>Cyber-Psychology Fundamentals</span>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================
            LIVE COMPONENTS SECTION
            ============================================ */}
        
        {/* Banner Component */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Banner</h2>
          <p className={styles.sectionDescription}>
            Announcement banner for site-wide messages. Full-width over a blurple fractal-line
            field, with centered text or a back-arrow breadcrumb trail on course pages.
          </p>
          <div className={styles.componentShowcase}>
            <div className={styles.componentLabel}>Banner</div>
            <div className={styles.componentPreview}>
              <Banner />
            </div>
            <div className={styles.componentMeta}>
              <code>components/banner/Banner.tsx</code>
            </div>
          </div>
        </section>

        {/* Diamond Display Component */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Diamond Display</h2>
          <p className={styles.sectionDescription}>
            Academy point system, earned through quests and activities.
          </p>
          <div className={styles.componentShowcase}>
            <div className={styles.componentLabel}>DiamondDisplay</div>
            <div className={styles.componentPreviewRow}>
              <div className={styles.componentVariant}>
                <span className={styles.variantLabel}>Small Amount</span>
                <SoulGemDisplay amount="150" />
              </div>
              <div className={styles.componentVariant}>
                <span className={styles.variantLabel}>Medium Amount</span>
                <SoulGemDisplay amount="2500" />
              </div>
              <div className={styles.componentVariant}>
                <span className={styles.variantLabel}>Large Amount</span>
                <SoulGemDisplay amount="1250000" />
              </div>
              <div className={styles.componentVariant}>
                <span className={styles.variantLabel}>No Label</span>
                <SoulGemDisplay amount="500" showLabel={false} />
              </div>
            </div>
            <div className={styles.componentMeta}>
              <code>components/soul-gems/SoulGemDisplay.tsx</code>
            </div>
          </div>
        </section>

        {/* Proposal Stages Component */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Proposal Stages</h2>
          <p className={styles.sectionDescription}>
            Visual progress indicator for governance proposals showing Blue review, blockchain transaction, and voting stages.
          </p>
          <div className={styles.componentShowcase}>
            <div className={styles.componentLabel}>ProposalStages</div>
            <div className={styles.componentPreviewColumn}>
              <div className={styles.componentVariant}>
                <span className={styles.variantLabel}>Waiting for Review</span>
                <ProposalStages stage1="waiting" stage2="waiting" stage3="waiting" />
              </div>
              <div className={styles.componentVariant}>
                <span className={styles.variantLabel}>Analyzing</span>
                <ProposalStages stage1="analyzing" stage2="waiting" stage3="waiting" />
              </div>
              <div className={styles.componentVariant}>
                <span className={styles.variantLabel}>Approved - Processing</span>
                <ProposalStages 
                  stage1="approved" 
                  stage2="processing" 
                  stage3="waiting" 
                  blueReasoning="This proposal aligns with community goals and has a clear implementation plan."
                  tokenAllocation={25}
                />
              </div>
              <div className={styles.componentVariant}>
                <span className={styles.variantLabel}>Active Voting</span>
                <ProposalStages stage1="approved" stage2="success" stage3="active" />
              </div>
              <div className={styles.componentVariant}>
                <span className={styles.variantLabel}>Completed</span>
                <ProposalStages stage1="approved" stage2="success" stage3="completed" />
              </div>
              <div className={styles.componentVariant}>
                <span className={styles.variantLabel}>Rejected</span>
                <ProposalStages 
                  stage1="rejected" 
                  stage2="waiting" 
                  stage3="waiting"
                  blueReasoning="This proposal does not meet the minimum requirements for community consideration."
                />
              </div>
            </div>
            <div className={styles.componentMeta}>
              <code>components/proposal-stages/ProposalStages.tsx</code>
            </div>
          </div>
        </section>

        {/* Blue Dialogue Component */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Blue Dialogue</h2>
          <p className={styles.sectionDescription}>
            Blue&apos;s visual-novel dialogue overlay. Typewritten lines, eight expression
            portraits, optional reward chip and reply field. Used for check-ins, first-run
            guides, and reward moments.
          </p>
          <div className={styles.componentShowcase}>
            <div className={styles.componentLabel}>BlueDialogue</div>
            <div className={styles.componentPreviewRow}>
              <CtaButton variant="primary" onClick={() => setBlueOpen(true)}>
                Open dialogue
              </CtaButton>
            </div>
            <div className={styles.componentMeta}>
              <code>components/blue-dialogue/BlueDialogue.tsx</code>
            </div>
          </div>
          <BlueDialogue
            open={blueOpen}
            onClose={() => setBlueOpen(false)}
            emotion="happy"
            title="Style guide"
            subtitle="Component demo"
            lines={[
              'This overlay is where I do my best work — the whole app dims, and for a breath it is just the two of us and the words.',
              'Every check-in, every reward, every first-run guide passes through this panel. Treat it gently.',
            ]}
          />
        </section>

        {/* Input Fields */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Input Fields</h2>
          <p className={styles.sectionDescription}>
            Form inputs with consistent styling, focus states, and validation.
          </p>
          <div className={styles.componentShowcase}>
            <div className={styles.componentLabel}>Inputs</div>
            <div className={styles.inputGrid}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Text Input</label>
                <input 
                  type="text" 
                  className={styles.textInput} 
                  placeholder="Enter your username..."
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>With Value</label>
                <input 
                  type="text" 
                  className={styles.textInput} 
                  defaultValue="@mentalwealth"
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Disabled</label>
                <input 
                  type="text" 
                  className={styles.textInput} 
                  placeholder="Disabled input"
                  disabled
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Textarea</label>
                <textarea 
                  className={styles.textArea} 
                  placeholder="Write your proposal description..."
                  rows={3}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Icons Reference */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Icon System</h2>
          <p className={styles.sectionDescription}>
            Icons come from the Phosphor set (<code>@phosphor-icons/react</code>), the same library
            used across the app. Default to the regular weight at 16-24px; icons inherit
            <code>currentColor</code> so they theme with the surrounding text.
          </p>
          <div className={styles.componentShowcase}>
            <div className={styles.componentLabel}>Phosphor Icons</div>
            <div className={styles.iconGrid}>
              {[
                { icon: <MagnifyingGlass size={24} />, name: 'MagnifyingGlass' },
                { icon: <Plus size={24} />, name: 'Plus' },
                { icon: <X size={24} />, name: 'X' },
                { icon: <Check size={24} />, name: 'Check' },
                { icon: <CheckCircle size={24} />, name: 'CheckCircle' },
                { icon: <XCircle size={24} />, name: 'XCircle' },
                { icon: <ArrowRight size={24} />, name: 'ArrowRight' },
                { icon: <ArrowLeft size={24} />, name: 'ArrowLeft' },
                { icon: <ArrowUpRight size={24} />, name: 'ArrowUpRight' },
                { icon: <ArrowsClockwise size={24} />, name: 'ArrowsClockwise' },
                { icon: <CaretDown size={24} />, name: 'CaretDown' },
                { icon: <CaretUp size={24} />, name: 'CaretUp' },
                { icon: <Bell size={24} />, name: 'Bell' },
                { icon: <Lock size={24} />, name: 'Lock' },
                { icon: <Key size={24} />, name: 'Key' },
                { icon: <Copy size={24} />, name: 'Copy' },
                { icon: <Trash size={24} />, name: 'Trash' },
                { icon: <PencilSimple size={24} />, name: 'PencilSimple' },
                { icon: <Sparkle size={24} />, name: 'Sparkle' },
                { icon: <Shield size={24} />, name: 'Shield' },
                { icon: <Coins size={24} />, name: 'Coins' },
                { icon: <Medal size={24} />, name: 'Medal' },
                { icon: <Cube size={24} />, name: 'Cube' },
                { icon: <GridFour size={24} />, name: 'GridFour' },
                { icon: <Rows size={24} />, name: 'Rows' },
                { icon: <Clock size={24} />, name: 'Clock' },
                { icon: <ChatCircle size={24} />, name: 'ChatCircle' },
                { icon: <Eye size={24} />, name: 'Eye' },
                { icon: <Robot size={24} />, name: 'Robot' },
                { icon: <Path size={24} />, name: 'Path' },
                { icon: <SealCheck size={24} />, name: 'SealCheck' },
                { icon: <Paperclip size={24} />, name: 'Paperclip' },
              ].map((item) => (
                <div key={item.name} className={styles.iconItem}>
                  {item.icon}
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Component Index */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Component Index</h2>
          <p className={styles.sectionDescription}>
            Complete list of all components available in the codebase.
          </p>
          <div className={styles.componentIndex}>
            <ComponentIndexItem
              name="Banner"
              path="components/banner"
              description="Site-wide announcement banner with breadcrumb trail"
            />
            <ComponentIndexItem
              name="CtaButton"
              path="components/shared"
              description="Canonical call-to-action button"
            />
            <ComponentIndexItem
              name="BlueDialogue"
              path="components/blue-dialogue"
              description="Blue's visual-novel dialogue overlay"
            />
            <ComponentIndexItem
              name="CourseFolderCard"
              path="components/home"
              description="Folder-style course card on /home"
            />
            <ComponentIndexItem
              name="FolderCardWrapper"
              path="components/home"
              description="Layout wrapper for folder card rows"
            />
            <ComponentIndexItem
              name="ProfileDashboard"
              path="components/home"
              description="Profile card with avatar, streak, and stats"
            />
            <ComponentIndexItem
              name="FieldNotesSheet"
              path="components/home"
              description="Field notes ledger bottom sheet"
            />
            <ComponentIndexItem
              name="DailyNotes"
              path="components/daily-notes"
              description="Daily note capture on /home"
            />
            <ComponentIndexItem
              name="HomeBento"
              path="components/home-bento"
              description="Bento grid dashboard on /dao"
            />
            <ComponentIndexItem
              name="FeatureTour"
              path="components/feature-tour"
              description="Daily Note first-run guide"
            />
            <ComponentIndexItem
              name="WelcomePremiumGate"
              path="components/welcome-premium"
              description="Welcome gate for premium onboarding"
            />
            <ComponentIndexItem
              name="SideNavigation"
              path="components/side-navigation"
              description="App-wide side navigation rail"
            />
            <ComponentIndexItem
              name="DiamondDisplay"
              path="components/soul-gems"
              description="Diamond point balance display"
            />
            <ComponentIndexItem
              name="DiamondReward"
              path="components/rewards"
              description="Diamond reward pop-up from Blue"
            />
            <ComponentIndexItem
              name="ProposalStages"
              path="components/proposal-stages"
              description="Proposal progress indicator"
            />
            <ComponentIndexItem
              name="SearchModal"
              path="components/search-modal"
              description="Global search modal"
            />
            <ComponentIndexItem
              name="AvatarSelectorModal"
              path="components/avatar-selector"
              description="Avatar selection modal"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

function ColorCard({ name, value }: { name: string; value: string }) {
  const isLight = isLightColor(value);
  
  return (
    <div className={styles.colorCard}>
      <div 
        className={styles.colorSwatch} 
        style={{ 
          backgroundColor: value,
          border: isLight ? '1px solid rgba(0,0,0,0.08)' : 'none'
        }} 
      />
      <div className={styles.colorInfo}>
        <div className={styles.colorName}>{name}</div>
        <div className={styles.colorValue}>{value}</div>
      </div>
    </div>
  );
}

function TypographySample({ 
  label, 
  text, 
  style, 
  meta 
}: { 
  label: string; 
  text: string; 
  style: React.CSSProperties; 
  meta: string;
}) {
  return (
    <div className={styles.typographySample}>
      <div className={styles.typographyLabel}>{label}</div>
      <div className={styles.typographyText} style={style}>{text}</div>
      <div className={styles.typographyMeta}>{meta}</div>
    </div>
  );
}

function ComponentIndexItem({ name, path, description }: { name: string; path: string; description: string }) {
  return (
    <div className={styles.indexItem}>
      <div className={styles.indexItemName}>{name}</div>
      <div className={styles.indexItemPath}><code>{path}</code></div>
      <div className={styles.indexItemDescription}>{description}</div>
    </div>
  );
}

// Helper function to determine if a color is light
function isLightColor(color: string): boolean {
  // Handle rgba colors
  if (color.startsWith('rgba')) return true;
  
  // Handle hex colors
  const hex = color.replace('#', '');
  if (hex.length !== 6) return false;
  
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.7;
}
