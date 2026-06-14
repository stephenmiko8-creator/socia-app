import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const text = searchParams.get('text') || 'Write your viral hook here...';
    const slide = searchParams.get('slide') || '1';
    const author = searchParams.get('author') || 'Socia User';
    const handle = searchParams.get('handle') || '@socia_user';
    const totalSlides = parseInt(searchParams.get('total') || '3');

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#0a0a0f',
            backgroundImage: 'radial-gradient(circle at 50% 50%, #2a2a3f 0%, #0a0a0f 100%)',
            padding: '80px',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Top badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              position: 'absolute',
              top: '80px',
              left: '80px',
            }}
          >
            <div
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '50px',
                background: 'linear-gradient(135deg, #FF3366, #FF9933)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '48px',
                fontWeight: 'bold',
                boxShadow: '0 10px 30px rgba(255,51,102,0.4)',
              }}
            >
              {author[0] || 'S'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '30px' }}>
              <div style={{ color: 'white', fontSize: '42px', fontWeight: 'bold' }}>{author}</div>
              <div style={{ color: '#a0a0b8', fontSize: '32px' }}>{handle}</div>
            </div>
          </div>
          
          {/* Main Text */}
          <div
            style={{
              display: 'flex',
              color: 'white',
              fontSize: '75px',
              fontWeight: 'bold',
              lineHeight: 1.3,
              textAlign: 'center',
              wordWrap: 'break-word',
              maxWidth: '900px',
              textShadow: '0 10px 30px rgba(0,0,0,0.5)',
            }}
          >
            {text}
          </div>
          
          {/* Footer Slide Indicator */}
          <div
            style={{
              position: 'absolute',
              bottom: '100px',
              display: 'flex',
              gap: '20px',
            }}
          >
            {Array.from({ length: totalSlides }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: (i + 1).toString() === slide ? '80px' : '30px',
                  height: '30px',
                  borderRadius: '15px',
                  background: (i + 1).toString() === slide ? '#FF3366' : 'rgba(255,255,255,0.2)',
                }}
              />
            ))}
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1920,
      }
    );
  } catch (e) {
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
