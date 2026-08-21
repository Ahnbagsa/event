import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

type Props = {
  value: string;
  size?: number;
};

// 오류 정정 수준을 낮게(L) 잡아야 긴 링크가 들어간다. 화면에 띄워 바로 찍는 용도라
// 인쇄물처럼 훼손을 견딜 필요가 없다.
export default function QrCode({ value, size = 280 }: Props) {
  const modules = useMemo(() => {
    if (value === '') return null;
    try {
      const code = qrcode(0, 'L');
      code.addData(value);
      code.make();
      const count = code.getModuleCount();
      const rows: boolean[][] = [];
      for (let row = 0; row < count; row += 1) {
        const cells: boolean[] = [];
        for (let column = 0; column < count; column += 1) {
          cells.push(code.isDark(row, column));
        }
        rows.push(cells);
      }
      return rows;
    } catch {
      // 한도를 넘으면 qrcode-generator가 오류를 던진다.
      return null;
    }
  }, [value]);

  if (modules === null) return null;

  const count = modules.length;
  const quiet = 2;
  const span = count + quiet * 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${span} ${span}`}
      role="img"
      aria-label="시나리오 링크 QR 코드"
      shapeRendering="crispEdges"
    >
      {/* QR은 검정·흰색 대비가 규격이다. 종이색·먹색으로 바꾸면 인식률이 떨어지므로
          여기서만 토큰을 쓰지 않고 순수한 흑백을 쓴다. */}
      <rect x="0" y="0" width={span} height={span} fill="#FFFFFF" />
      {modules.map((cells, row) =>
        cells.map((dark, column) =>
          dark ? (
            <rect
              key={`${row}-${column}`}
              x={column + quiet}
              y={row + quiet}
              width="1"
              height="1"
              fill="#000000"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}
