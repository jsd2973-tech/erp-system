# 별도 Supabase 배차 권한 QA 환경

> 운영 Supabase와 `main`에는 적용하지 않습니다. 운영 개인정보, 실제 기사/직원 이메일, 전화번호, 첨부파일/Storage 객체는 복사하지 않습니다.

## 1. 새 테스트 Supabase 프로젝트

새 빈 Supabase 프로젝트를 만들고 Authentication > Users에서 아래 **가상 계정** 6개를 생성합니다.

- `qa.admin@example.com`
- `qa.vehicle@example.com`
- `qa.driveradmin@example.com`
- `qa.basics@example.com`
- `qa.register@example.com`
- `qa.mobile.driver@example.com`

모두 테스트 전용 비밀번호를 사용합니다. 운영 비밀번호를 재사용하지 않습니다.

## 2. SQL 적용 순서

SQL Editor에서 다음 순서대로 실행합니다.

1. `dispatch_phase1.sql`
   - `dispatch_admin_users`, 차량/기사/배차/배차-차량 테이블, `is_dispatch_admin`, 기본 RLS, `save_dispatch_order` 생성
2. `dispatch_test_support.sql`
   - 테스트에 필요한 최소 `user_permissions` 테이블과 RLS만 생성
3. `dispatch_phase1_1_customer_location.sql`
   - 배차 거래처/상하차지 마스터
4. `dispatch_phase1_2_items.sql`
   - 배차 품목 마스터
5. `dispatch_phase2_driver_trips.sql`
   - 기사 `auth_user_id`, 운행기록, 기사 모바일 RPC/RLS
6. `dispatch_trip_shared_progress.sql`
   - 같은 배차에 참여한 기사끼리 진행상황 SELECT 공유
7. `dispatch_order_trash.sql`
   - 배차 휴지통/복구/영구삭제 함수
8. `dispatch_office_editor_rls_review.sql`
   - 현재 테스트 브랜치의 직원별 운행관리 권한/RLS 최종 검토안

`dispatch_admin_delete_order.sql`은 `dispatch_order_trash.sql`보다 과거 방식의 즉시삭제 함수이므로 **테스트 환경에는 실행하지 않습니다.** 휴지통 방식을 덮어쓸 수 있습니다.

## 3. 테스트 관리자 연결

Authentication > Users에서 `qa.admin@example.com`의 UUID를 확인한 뒤 TEST DB에서만 실행합니다.

```sql
insert into public.dispatch_admin_users(user_id)
values ('QA_ADMIN_AUTH_UUID')
on conflict do nothing;
```

로컬 UI에서 관리자 기능까지 시험하려면 `.env.local`의 `VITE_TEST_ADMIN_EMAIL=qa.admin@example.com` 설정을 사용하도록 테스트 브랜치를 구성합니다.

## 4. 직원별 권한 데이터

TEST DB에서만 아래와 같이 최소 권한을 생성합니다.

```sql
insert into public.user_permissions(id,email,role,permissions) values
('qa-vehicle','qa.vehicle@example.com','office','{"dispatch_vehicles":true}'::jsonb),
('qa-driveradmin','qa.driveradmin@example.com','office','{"dispatch_drivers":true}'::jsonb),
('qa-basics','qa.basics@example.com','office','{"dispatch_basics":true}'::jsonb),
('qa-register','qa.register@example.com','office','{"dispatch_register":true}'::jsonb)
on conflict (email) do update
set role = excluded.role,
    permissions = excluded.permissions;
```

## 5. 최소 시험 데이터

운영 데이터를 복사하지 않고 가상 데이터만 사용합니다.

관리자 계정으로 UI 또는 SQL을 통해 다음 정도만 만듭니다.

- 차량: `TEST-01`, `TEST-02`
- 기사: `테스트기사A`, `테스트기사B`
- 거래처: `테스트거래처`
- 장소: `테스트상차지`, `테스트하차지`
- 품목: `테스트골재`
- 배차: 오늘 날짜 1건, 총물량 34 / 회당 17

`qa.mobile.driver@example.com`의 Auth UUID는 `테스트기사A.auth_user_id`에 관리자 계정으로 연결합니다.

## 6. 로컬 앱을 TEST Supabase로 강제 연결

프로젝트 루트의 `.env.local`에 아래 값을 넣습니다. `.env.local`은 gitignore의 `*.local`에 의해 커밋되지 않습니다.

```env
VITE_SUPABASE_TEST_MODE=1
VITE_SUPABASE_URL=https://TEST_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=TEST_PROJECT_PUBLISHABLE_OR_ANON_KEY
VITE_TEST_ADMIN_EMAIL=qa.admin@example.com
```

`VITE_SUPABASE_TEST_MODE=1`인데 URL 또는 key가 없으면 앱이 시작 단계에서 에러를 내도록 하여 운영 DB로 잘못 붙는 것을 막습니다.

설정 후 Vite를 완전히 재시작합니다.

```powershell
npm run dev -- --host
```

## 7. 실제 계정 검증 시나리오

각 계정은 브라우저 프로필/시크릿 창을 분리하거나 로그아웃 후 다시 로그인하여 세션을 섞지 않습니다.

### 차량관리만
- 차량 목록 조회 성공
- 차량 등록/수정 성공
- 기사/기초관리/배차 API 직접 접근 차단 확인
- 삭제 차단 확인

### 기사관리만
- 기사+차량 조회 성공
- 기사 일반정보/담당차량 수정 성공
- `auth_user_id` 설정/변경/해제 실패 확인
- 다른 메뉴 write 차단 확인

### 기초관리만
- 거래처/장소/품목 조회·등록·수정 성공
- 배차/차량/기사 write 차단 확인

### 배차등록만
- 배차에 필요한 차량/기사/배차/기초자료 조회 성공
- 배차 등록/수정 성공
- 신규 거래처/장소/품목 INSERT 성공
- 기존 마스터 UPDATE 차단 확인
- 동일 정규화 이름 INSERT 시 기존 자료 덮어쓰기 없이 `23505` 또는 UI 중복 경고로 중단 확인
- 배차목록 권한이 없으므로 저장 후 강제 이동하지 않는지 확인

### 권한 해제
- 관리자 계정에서 해당 직원의 permissions 키를 false/삭제
- 직원은 재로그인하지 않아도 **다음 DB 요청부터** RLS 차단되는지 확인

### 삭제/복구/영구삭제
- 일반 직원 계정에서 RPC 직접 호출 시 모두 권한 예외가 나는지 확인
- 관리자 계정에서는 휴지통 이동/복구/영구삭제가 정상인지 확인

### 기사 모바일
- `qa.mobile.driver@example.com` 로그인
- 본인 차량 배차만 조회되는지 확인
- 운행 시작 → 상차완료 → 하차완료 정상
- 다른 기사 운행 수정 차단

### 입력값 유지
- 배차/차량/기사/기초관리 폼에 저장하지 않은 값을 입력
- 새로고침 버튼으로 데이터 재조회
- Alt+Tab 후 다시 복귀
- 입력값이 유지되는지 확인

## 8. 통과 판단

SQL Editor에서 관리자 권한으로 쿼리가 성공한 것만으로는 통과로 판단하지 않습니다. 반드시 위 실제 Auth 계정으로 로그인한 세션의 JWT를 통해 UI/클라이언트 요청을 수행하고, 허용/차단 양쪽을 확인합니다.
