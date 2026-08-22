import type { Locale } from '@/lib/i18n';
import { TERMS } from '@/content/taxonomy';

/**
 * 갤러리 사진 시드 데이터.
 * 나중에 DB(Photo 테이블)로 옮길 것을 전제로 한 모양이다 — 한 객체가 한 행.
 * 파일 경로는 public/images 아래 실제로 존재하는 파일만 쓴다. width/height는 원본 픽셀값.
 * status가 PUBLISHED인 것만 프론트에 나온다(UNSORTED = 수집만 된 상태, ARCHIVED = 내린 것).
 * alt / story는 관리자가 교체할 시드 문안이며, 확인되지 않은 사실은 쓰지 않는다.
 */

type L10n = Record<Locale, string>;

export type PhotoStatus = 'PUBLISHED' | 'UNSORTED' | 'ARCHIVED';

export type Photo = {
  id: string;
  slug: string;
  src: string;
  width: number;
  height: number;
  alt: L10n;
  story: L10n;
  /** 촬영일 (YYYY-MM-DD) */
  takenAt: string;
  /** taxonomy term slug 배열 */
  terms: string[];
  /** site.ts의 Plan.code — 상세 페이지에서 요금을 끌어온다 */
  planCode?: string;
  dress?: L10n;
  status: PhotoStatus;
  /** 'video' 면 src 가 포스터, videoUrl 이 mp4 다. 생략 시 image. */
  mediaType?: 'image' | 'video';
  videoUrl?: string | null;
};

export const PHOTOS: Photo[] = [
  {
    id: 'p-0001',
    slug: 'studio-arch-window-morning-light',
    src: '/images/studio/IMG_0766.png',
    width: 560,
    height: 315,
    alt: {
      ja: 'アーチ窓のそばで撮影したスタジオのセルフウェディング',
      en: 'Self-wedding session beside the arched studio window',
      ko: '아치 창 곁에서 촬영한 스튜디오 셀프 웨딩',
    },
    story: {
      ja: 'アーチ窓のそばで、セルフウェディングの撮影。ヘアメイクからドレスまでスタジオで整えて、光のやわらかい時間に撮影しました。',
      en: 'A self-wedding session beside the arched window. Hair, make-up and dress were all prepared in the studio, and we photographed while the light was still soft.',
      ko: '아치 창 곁에서 진행한 셀프 웨딩 촬영입니다. 헤어메이크업과 드레스를 스튜디오에서 모두 준비하고, 빛이 부드러운 시간에 찍었습니다.',
    },
    takenAt: '2026-06-14',
    terms: ['studio', 'wedding', 'arch-window'],
    planCode: 'studio-01',
    dress: { ja: 'ホワイト ・ クラシック', en: 'White, classic', ko: '화이트 · 클래식' },
    status: 'PUBLISHED',
  },
  {
    id: 'p-0002',
    slug: 'studio-arch-window-wedding',
    src: '/images/studio/IMG_0690.png',
    width: 560,
    height: 315,
    alt: {
      ja: 'ヘリンボーンの床とアーチ窓のスタジオセット',
      en: 'Studio set with a herringbone floor and the arched window',
      ko: '헤링본 바닥과 아치 창이 있는 스튜디오 세트',
    },
    story: {
      ja: 'ヘリンボーンの床とシャンデリアのある一角。窓から入る自然光だけで、前撮りの一枚を撮りました。',
      en: 'The corner with the herringbone floor and the chandelier. This pre-wedding frame was made with nothing but the daylight from the window.',
      ko: '헤링본 바닥과 샹들리에가 있는 자리입니다. 창으로 들어오는 자연광만으로 본식 전 웨딩 한 컷을 담았습니다.',
    },
    takenAt: '2026-06-14',
    terms: ['studio', 'wedding', 'arch-window'],
    planCode: 'studio-01',
    dress: { ja: 'ホワイト ・ クラシック', en: 'White, classic', ko: '화이트 · 클래식' },
    status: 'PUBLISHED',
  },
  {
    id: 'p-0003',
    slug: 'studio-dress-room-veil',
    src: '/images/studio/IMG_0695.png',
    width: 315,
    height: 560,
    alt: {
      ja: '白のドレスとベールが並ぶスタジオのドレスルーム',
      en: 'The studio dress room, with white dresses and veils',
      ko: '흰 드레스와 베일이 걸린 스튜디오 드레스룸',
    },
    story: {
      ja: 'ドレスルームで支度を整えているところ。着替えの合間の、まだ緊張がほどけていない時間です。',
      en: 'Getting ready in the dress room — the moment between changes, before the nerves have quite settled.',
      ko: '드레스룸에서 준비하던 중입니다. 옷을 갈아입는 사이, 아직 긴장이 풀리지 않은 시간입니다.',
    },
    takenAt: '2026-06-14',
    terms: ['studio', 'wedding', 'dress-room'],
    planCode: 'studio-01',
    dress: { ja: 'ホワイト ・ クラシック', en: 'White, classic', ko: '화이트 · 클래식' },
    status: 'PUBLISHED',
  },
  {
    id: 'p-0004',
    slug: 'studio-arch-into-dress-room',
    src: '/images/studio/IMG_0769.png',
    width: 315,
    height: 560,
    alt: {
      ja: 'ドレスルームへ続くアーチの入口',
      en: 'The arch leading through to the dress room',
      ko: '드레스룸으로 이어지는 아치 입구',
    },
    story: {
      ja: 'ドレスルームへ続くアーチ。スタジオの中でいちばん白い場所で、前撮りの一枚を残しました。',
      en: 'The arch that leads through to the dress room — the whitest corner of the studio, and where we made this pre-wedding frame.',
      ko: '드레스룸으로 이어지는 아치입니다. 스튜디오에서 가장 흰 자리라 본식 전 웨딩 한 컷을 남겼습니다.',
    },
    takenAt: '2026-05-30',
    terms: ['studio', 'wedding', 'dress-room'],
    planCode: 'studio-01',
    status: 'PUBLISHED',
  },
  {
    id: 'p-0005',
    slug: 'studio-vintage-corner-anniversary',
    src: '/images/studio/IMG_0746.png',
    width: 560,
    height: 315,
    alt: {
      ja: 'チーク家具とレースを合わせたヴィンテージコーナー',
      en: 'The vintage corner, teak furniture with lace',
      ko: '티크 가구와 레이스를 둔 빈티지 코너',
    },
    story: {
      ja: 'チーク家具とレースを合わせたヴィンテージコーナー。記念日の撮影で使うことが多い一角です。',
      en: 'The vintage corner, where teak furniture meets lace. It is the set we use most often for anniversary sessions.',
      ko: '티크 가구와 레이스를 맞춘 빈티지 코너입니다. 기념일 촬영에서 자주 쓰는 자리입니다.',
    },
    takenAt: '2026-05-22',
    terms: ['studio', 'anniversary', 'vintage-corner'],
    planCode: 'studio-04',
    status: 'PUBLISHED',
  },
  {
    id: 'p-0006',
    slug: 'studio-dress-collection',
    src: '/images/studio/IMG_0698.png',
    width: 560,
    height: 315,
    alt: {
      ja: 'スタジオに並ぶドレスコレクション',
      en: 'The dress collection hanging in the studio',
      ko: '스튜디오에 걸린 드레스 컬렉션',
    },
    story: {
      ja: '当日お選びいただけるドレスを並べたところ。実際に手に取って決めていただけます。',
      en: 'The dresses laid out to choose from on the day. You can handle them and decide in the room.',
      ko: '당일 고르실 수 있는 드레스를 걸어둔 모습입니다. 직접 만져보고 정하실 수 있습니다.',
    },
    takenAt: '2026-05-22',
    terms: ['studio', 'wedding', 'dress-room'],
    planCode: 'studio-02',
    status: 'PUBLISHED',
  },
  {
    id: 'p-0007',
    slug: 'studio-monotone-family',
    src: '/images/studio/IMG_0747.png',
    width: 315,
    height: 560,
    alt: {
      ja: '黒とグリーンが対になったモノトーンコーナー',
      en: 'The monotone corner, black against green',
      ko: '블랙과 초록이 마주 놓인 모노톤 코너',
    },
    story: {
      ja: '黒とグリーンのコントラストで、少し落ち着いた雰囲気に。ご家族の撮影で選ばれることが多い場所です。',
      en: 'Black against green, for a quieter mood. Families often choose this corner.',
      ko: '블랙과 초록의 대비로 조금 담백한 분위기입니다. 가족 촬영에서 자주 고르시는 자리입니다.',
    },
    takenAt: '2026-05-09',
    terms: ['studio', 'family', 'monotone-corner'],
    planCode: 'studio-04',
    status: 'PUBLISHED',
  },
  {
    id: 'p-0008',
    slug: 'studio-monotone-maternity',
    src: '/images/studio/IMG_0789.png',
    width: 315,
    height: 560,
    alt: {
      ja: 'モノトーンのセットで撮影したマタニティフォト',
      en: 'Maternity session photographed on the monotone set',
      ko: '모노톤 세트에서 촬영한 만삭 사진',
    },
    story: {
      ja: 'マタニティ専用の衣装で、モノトーンのセットにて。ウェディング風の仕立てにしています。',
      en: 'A maternity outfit on the monotone set, styled in the same way as a wedding session.',
      ko: '만삭 전용 의상으로 모노톤 세트에서 촬영했습니다. 웨딩풍으로 연출했습니다.',
    },
    takenAt: '2026-04-26',
    terms: ['studio', 'maternity', 'monotone-corner'],
    planCode: 'studio-03',
    status: 'PUBLISHED',
  },
  {
    id: 'p-0009',
    slug: 'location-sunny-wedding-shore',
    src: '/images/up/0f62c6d466bcea42.jpg',
    width: 1000,
    height: 668,
    alt: {
      ja: '晴れた日の沖縄でのロケーションウェディングフォト',
      en: 'Location wedding session in Okinawa on a clear day',
      ko: '맑은 날 오키나와에서 촬영한 로케이션 웨딩',
    },
    story: {
      ja: '雲の少ない日に、屋外での前撮り。光が強い時間を避けて、午後から動きました。',
      en: 'An outdoor pre-wedding session on a day with barely a cloud. We started in the afternoon to avoid the harshest light.',
      ko: '구름이 적은 날 야외에서 진행한 본식 전 웨딩입니다. 빛이 강한 시간을 피해 오후부터 움직였습니다.',
    },
    takenAt: '2026-06-08',
    terms: ['location', 'wedding', 'sunny'],
    planCode: 'location-basic',
    status: 'PUBLISHED',
  },
  {
    id: 'p-0010',
    slug: 'location-sunny-couples',
    src: '/images/up/441db675bf47ff78.jpg',
    width: 1200,
    height: 801,
    alt: {
      ja: '晴れた日の沖縄でのデート撮影',
      en: 'Couples session in Okinawa on a sunny day',
      ko: '맑은 날 오키나와에서 촬영한 커플 사진',
    },
    story: {
      ja: '記念日に合わせたデート撮影。歩いているところをそのまま撮っています。',
      en: 'A couples session arranged around an anniversary, photographed as they walked.',
      ko: '기념일에 맞춘 커플 촬영입니다. 걷는 모습을 그대로 담았습니다.',
    },
    takenAt: '2026-06-02',
    terms: ['location', 'couples', 'sunny'],
    planCode: 'location-simple',
    status: 'PUBLISHED',
  },
  {
    id: 'p-0011',
    slug: 'location-family-sunny',
    src: '/images/up/934c72ebb62d141a.jpg',
    width: 668,
    height: 1000,
    alt: {
      ja: '沖縄の屋外で撮影した家族写真',
      en: 'Family portrait photographed outdoors in Okinawa',
      ko: '오키나와 야외에서 촬영한 가족사진',
    },
    story: {
      ja: 'ご家族での屋外撮影。お子さまのペースに合わせて、短い時間で回りました。',
      en: 'A family session outdoors. We kept the route short and moved at the children’s pace.',
      ko: '가족과 함께한 야외 촬영입니다. 아이의 속도에 맞춰 짧게 돌았습니다.',
    },
    takenAt: '2026-05-25',
    terms: ['location', 'family', 'sunny'],
    planCode: 'location-simple',
    status: 'PUBLISHED',
  },
  {
    id: 'p-0012',
    slug: 'location-sunset-wedding',
    src: '/images/up/c0aa505600aa3595.jpg',
    width: 668,
    height: 1000,
    alt: {
      ja: 'サンセットの時間に撮影したロケーションウェディングフォト',
      en: 'Location wedding session photographed into the sunset',
      ko: '노을 시간에 촬영한 로케이션 웨딩',
    },
    story: {
      ja: '日が落ちるまでの時間に合わせた撮影。色が変わっていく間だけ撮れる一枚です。',
      en: 'Timed to the last of the daylight — this frame only exists while the colour is turning.',
      ko: '해가 지기까지의 시간에 맞춘 촬영입니다. 색이 바뀌는 동안에만 담을 수 있는 컷입니다.',
    },
    takenAt: '2026-05-18',
    terms: ['location', 'wedding', 'sunset'],
    planCode: 'location-basic',
    status: 'PUBLISHED',
  },
  {
    id: 'p-0013',
    slug: 'location-cloudy-couples',
    src: '/images/up/ddb78d75fc3e564b.jpg',
    width: 668,
    height: 1000,
    alt: {
      ja: '曇りの日の沖縄でのデート撮影',
      en: 'Couples session in Okinawa under cloud',
      ko: '흐린 날 오키나와에서 촬영한 커플 사진',
    },
    story: {
      ja: '曇りの日は影が出ないので、肌の色がやわらかく写ります。雨の予報でもそのまま撮影しました。',
      en: 'Cloud removes the hard shadows, so skin tones stay soft. Rain was forecast and we photographed anyway.',
      ko: '흐린 날은 그림자가 지지 않아 피부색이 부드럽게 나옵니다. 비 예보에도 그대로 촬영했습니다.',
    },
    takenAt: '2026-05-11',
    terms: ['location', 'couples', 'cloudy'],
    planCode: 'location-simple',
    status: 'PUBLISHED',
  },
  {
    id: 'p-0014',
    slug: 'location-family-seven-five-three',
    src: '/images/up/ddf6db884e95f47c.jpg',
    width: 1000,
    height: 667,
    alt: {
      ja: '沖縄で撮影した七五三の家族写真',
      en: 'Family portrait for a childhood milestone in Okinawa',
      ko: '오키나와에서 촬영한 아이 기념일 가족사진',
    },
    story: {
      ja: '節目の日に合わせたご家族の撮影。全員がそろう時間に合わせて短くまとめました。',
      en: 'A family session on a milestone day, kept short so that everyone could be there at once.',
      ko: '아이의 기념일에 맞춘 가족 촬영입니다. 모두 모이는 시간에 맞춰 짧게 진행했습니다.',
    },
    takenAt: '2026-05-04',
    terms: ['location', 'family', 'sunny'],
    planCode: 'location-simple',
    status: 'PUBLISHED',
  },
  {
    id: 'p-0015',
    slug: 'location-self-wedding-sunset',
    src: '/images/up/1440241c37bf4fc2.jpg',
    width: 1000,
    height: 668,
    alt: {
      ja: 'サンセットに撮影したセルフウェディング',
      en: 'Self-wedding session photographed at sunset',
      ko: '노을에 촬영한 셀프 웨딩',
    },
    story: {
      ja: 'おふたりだけのセルフウェディング。式は挙げず、写真だけを残す選び方です。',
      en: 'A self-wedding for the two of them. No ceremony — only the photographs.',
      ko: '두 분만의 셀프 웨딩입니다. 예식 없이 사진만 남기는 방식입니다.',
    },
    takenAt: '2026-04-20',
    terms: ['location', 'wedding', 'sunset'],
    planCode: 'location-basic',
    status: 'PUBLISHED',
  },
  {
    id: 'p-0016',
    slug: 'location-wedding-daylight',
    src: '/images/up/dfc72117f85239be.jpg',
    width: 1000,
    height: 668,
    alt: {
      ja: '日中に撮影した沖縄のウェディングフォト',
      en: 'Okinawa wedding photograph made in daylight',
      ko: '한낮에 촬영한 오키나와 웨딩 사진',
    },
    story: {
      ja: '日中の屋外撮影。移動を1ヶ所にしぼって、ゆっくり時間をとりました。',
      en: 'An outdoor session in the middle of the day. We stayed at one place and took our time.',
      ko: '한낮의 야외 촬영입니다. 이동을 한 곳으로 줄이고 시간을 넉넉히 썼습니다.',
    },
    takenAt: '2026-04-12',
    terms: ['location', 'wedding', 'sunny'],
    planCode: 'location-simple',
    status: 'PUBLISHED',
  },
  {
    id: 'p-0017',
    slug: 'location-wedding-last-light',
    src: '/images/up/0050ef5841c8d683.jpg',
    width: 682,
    height: 1024,
    alt: {
      ja: '夕方の光で撮影したロケーションウェディングフォト',
      en: 'Location wedding session in the last light of the day',
      ko: '저녁 빛으로 촬영한 로케이션 웨딩',
    },
    story: {
      ja: '3ヶ所を回る長めのプランで、最後に撮った一枚です。',
      en: 'The final frame of a longer plan that moved through three locations.',
      ko: '세 곳을 도는 긴 플랜에서 마지막으로 찍은 컷입니다.',
    },
    takenAt: '2026-04-05',
    terms: ['location', 'wedding', 'sunset'],
    planCode: 'location-afterfull',
    status: 'PUBLISHED',
  },
  {
    id: 'p-0018',
    slug: 'location-couples-overcast',
    src: '/images/up/00eaf9577f08d529.jpg',
    width: 600,
    height: 901,
    alt: {
      ja: '曇り空の下で撮影したカップル写真',
      en: 'Couples photograph made under an overcast sky',
      ko: '흐린 하늘 아래에서 촬영한 커플 사진',
    },
    story: {
      ja: '曇り空のやわらかい光で。旅行の途中に1時間だけお預かりしました。',
      en: 'Soft light under cloud. We borrowed an hour in the middle of their trip.',
      ko: '흐린 하늘의 부드러운 빛으로 촬영했습니다. 여행 중 한 시간만 시간을 냈습니다.',
    },
    takenAt: '2026-03-28',
    terms: ['location', 'couples', 'cloudy'],
    planCode: 'location-simple',
    status: 'PUBLISHED',
  },
  {
    id: 'p-0019',
    slug: 'location-maternity-outdoor',
    src: '/images/up/02c9c4f3dac1040e.jpg',
    width: 668,
    height: 1000,
    alt: {
      ja: '屋外で撮影したマタニティフォト',
      en: 'Maternity photograph made outdoors',
      ko: '야외에서 촬영한 만삭 사진',
    },
    story: {
      ja: '屋外でのマタニティ撮影。体調に合わせて、休みながら進めました。',
      en: 'A maternity session outdoors, with breaks along the way as needed.',
      ko: '야외 만삭 촬영입니다. 컨디션에 맞춰 쉬어가며 진행했습니다.',
    },
    takenAt: '2026-03-21',
    terms: ['location', 'maternity', 'sunny'],
    planCode: 'location-simple',
    status: 'PUBLISHED',
  },
  {
    id: 'p-0020',
    slug: 'location-wedding-soft-cloud',
    src: '/images/up/0311d30740475506.jpg',
    width: 1000,
    height: 668,
    alt: {
      ja: '雲の多い日に撮影したウェディングフォト',
      en: 'Wedding photograph made on a cloudy day',
      ko: '구름 많은 날 촬영한 웨딩 사진',
    },
    story: {
      ja: '雲が厚い日でしたが、そのぶん色がおだやかに出ました。',
      en: 'The cloud was heavy that day, which kept the colours calm.',
      ko: '구름이 두꺼운 날이었지만 그만큼 색이 차분하게 나왔습니다.',
    },
    takenAt: '2026-03-14',
    terms: ['location', 'wedding', 'cloudy'],
    planCode: 'location-basic',
    status: 'PUBLISHED',
  },
  {
    id: 'p-0021',
    slug: 'location-self-wedding-morning',
    src: '/images/up/06373e83a2698794.jpg',
    width: 1000,
    height: 668,
    alt: {
      ja: '朝の時間に撮影したセルフウェディング',
      en: 'Self-wedding session photographed in the morning',
      ko: '아침 시간에 촬영한 셀프 웨딩',
    },
    story: {
      ja: '人の少ない朝の時間に合わせた撮影。1ヶ所だけをゆっくり歩きました。',
      en: 'Photographed early, while it was still quiet. We walked one place slowly.',
      ko: '사람이 적은 아침 시간에 맞춘 촬영입니다. 한 곳만 천천히 걸었습니다.',
    },
    takenAt: '2026-03-07',
    terms: ['location', 'wedding', 'sunny'],
    planCode: 'location-simple',
    status: 'PUBLISHED',
  },
  {
    id: 'p-0022',
    slug: 'location-anniversary-sunset',
    src: '/images/up/0abe06fc79f2e2fe.jpg',
    width: 966,
    height: 1352,
    alt: {
      ja: '結婚記念日に合わせて撮影した夕方の一枚',
      en: 'Evening photograph made for a wedding anniversary',
      ko: '결혼기념일에 맞춰 촬영한 저녁 사진',
    },
    story: {
      ja: '結婚記念日に合わせた撮影。ドレスをもう一度着ていただきました。',
      en: 'Photographed for a wedding anniversary. The dress came out one more time.',
      ko: '결혼기념일에 맞춘 촬영입니다. 드레스를 다시 한 번 입으셨습니다.',
    },
    takenAt: '2026-02-28',
    terms: ['location', 'wedding', 'sunset'],
    planCode: 'location-basic',
    status: 'PUBLISHED',
  },
  {
    id: 'p-0023',
    slug: 'location-couples-unsorted',
    src: '/images/up/0c97ace763a7cc23.jpg',
    width: 1280,
    height: 855,
    alt: {
      ja: '未分類のロケーション撮影データ',
      en: 'Unsorted location session frame',
      ko: '아직 분류하지 않은 로케이션 촬영 컷',
    },
    story: {
      ja: '収集済み・掲載前のデータです。',
      en: 'Collected but not yet selected for display.',
      ko: '수집만 되고 아직 전시하지 않은 데이터입니다.',
    },
    takenAt: '2026-02-14',
    terms: ['location', 'couples', 'cloudy'],
    status: 'UNSORTED',
  },
  {
    id: 'p-0024',
    slug: 'location-wedding-archived',
    src: '/images/up/1195f44c75e53cfa.jpg',
    width: 1200,
    height: 801,
    alt: {
      ja: '掲載を終了したロケーション撮影の一枚',
      en: 'Location session frame no longer on display',
      ko: '전시를 내린 로케이션 촬영 컷',
    },
    story: {
      ja: '掲載を終了したデータです。',
      en: 'No longer on display.',
      ko: '전시를 내린 데이터입니다.',
    },
    takenAt: '2026-01-31',
    terms: ['location', 'wedding', 'sunny'],
    status: 'ARCHIVED',
  },
];

/** 프론트에 노출되는 사진 — 최신순 */
export const PUBLISHED_PHOTOS: Photo[] = PHOTOS.filter((p) => p.status === 'PUBLISHED').sort(
  (a, b) => b.takenAt.localeCompare(a.takenAt),
);

/** 선택된 term slug를 모두 가진 사진만 남긴다(AND 조건). */
export function filterPhotos(termSlugs: string[]): Photo[] {
  if (termSlugs.length === 0) return PUBLISHED_PHOTOS;
  return PUBLISHED_PHOTOS.filter((photo) => termSlugs.every((slug) => photo.terms.includes(slug)));
}

export function findPhoto(slug: string): Photo | undefined {
  return PUBLISHED_PHOTOS.find((p) => p.slug === slug);
}

/** 같은 세트·계절(mood 축)에서 찍은 다른 사진 */
export function sameSetPhotos(photo: Photo, limit = 4): Photo[] {
  const moodSlugs = TERMS.filter((t) => t.taxonomy === 'mood' && photo.terms.includes(t.slug)).map(
    (t) => t.slug,
  );
  return PUBLISHED_PHOTOS.filter(
    (p) => p.slug !== photo.slug && p.terms.some((t) => moodSlugs.includes(t)),
  ).slice(0, limit);
}
