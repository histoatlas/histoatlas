type Badge = {
  text: string;
  bg: string;
  fg: string;
};

type OgLayoutProps = {
  title: string;
  subtitle?: string;
  badge?: Badge;
  meta?: string;
};

export function ogLayout({ title, subtitle, badge, meta }: OgLayoutProps): unknown {
  const titleSize = title.length > 50 ? 40 : 48;

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#ffffff',
        fontFamily: 'Inter',
      },
      children: [
        // Main content area
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              flex: 1,
              paddingLeft: 80,
              paddingRight: 80,
              paddingTop: 60,
              paddingBottom: 20,
            },
            children: [
              // Badge
              badge
                ? {
                    type: 'div',
                    props: {
                      style: {
                        display: 'flex',
                        marginBottom: 20,
                      },
                      children: {
                        type: 'span',
                        props: {
                          style: {
                            backgroundColor: badge.bg,
                            color: badge.fg,
                            fontSize: 16,
                            fontWeight: 600,
                            paddingLeft: 14,
                            paddingRight: 14,
                            paddingTop: 6,
                            paddingBottom: 6,
                            borderRadius: 8,
                          },
                          children: badge.text,
                        },
                      },
                    },
                  }
                : null,
              // Title
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: titleSize,
                    fontWeight: 600,
                    color: '#18181b',
                    lineHeight: 1.2,
                    maxWidth: '85%',
                  },
                  children: title,
                },
              },
              // Subtitle
              subtitle
                ? {
                    type: 'div',
                    props: {
                      style: {
                        fontSize: 24,
                        color: '#71717a',
                        marginTop: 16,
                        maxWidth: '80%',
                        lineHeight: 1.4,
                      },
                      children: subtitle,
                    },
                  }
                : null,
              // Meta line
              meta
                ? {
                    type: 'div',
                    props: {
                      style: {
                        fontSize: 18,
                        color: '#a1a1aa',
                        marginTop: 12,
                      },
                      children: meta,
                    },
                  }
                : null,
            ].filter(Boolean),
          },
        },
        // Bottom bar
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingLeft: 80,
              paddingRight: 80,
              paddingTop: 20,
              paddingBottom: 24,
              backgroundColor: '#f4f4f5',
              borderTop: '1px solid #e4e4e7',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 22,
                    fontWeight: 600,
                    color: '#3f3f46',
                  },
                  children: 'HistoAtlas',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 18,
                    color: '#a1a1aa',
                  },
                  children: 'histoatlas.com',
                },
              },
            ],
          },
        },
      ],
    },
  };
}
