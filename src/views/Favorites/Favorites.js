import {useState, useEffect, useCallback, useRef, useMemo} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Spotlight from '@enact/spotlight';
import {useAuth} from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import ProxiedImage from '../../components/ProxiedImage';
import {getImageUrl, getPrimaryImageId} from '../../utils/helpers';
import {isBackKey} from '../../utils/tizenKeys';

import css from './Favorites.module.less';

const SpottableDiv = Spottable('div');
const SpottableButton = Spottable('button');
const RowContainer = SpotlightContainerDecorator({enterTo: 'last-focused', restrict: 'self-first'}, 'div');

const ITEMS_PER_PAGE = 20;

const Favorites = ({onSelectItem, onSelectPerson, onBack}) => {
	const {api, serverUrl} = useAuth();
	const [items, setItems] = useState({movies: [], shows: [], episodes: [], people: []});
	const [isLoading, setIsLoading] = useState(true);
	const [displayCounts, setDisplayCounts] = useState({});
	const scrollerRefs = useRef({});

	const getVisibleItems = useCallback((itemList, rowId) => {
		const count = displayCounts[rowId] || ITEMS_PER_PAGE;
		return itemList.slice(0, count);
	}, [displayCounts]);

	const rows = useMemo(() => {
		const rowsData = [];
		if (items.movies.length > 0) rowsData.push({id: 'movies', title: 'Movies', items: getVisibleItems(items.movies, 'movies'), totalCount: items.movies.length});
		if (items.shows.length > 0) rowsData.push({id: 'shows', title: 'TV Shows', items: getVisibleItems(items.shows, 'shows'), totalCount: items.shows.length});
		if (items.episodes.length > 0) rowsData.push({id: 'episodes', title: 'Episodes', items: getVisibleItems(items.episodes, 'episodes'), totalCount: items.episodes.length});
		if (items.people.length > 0) rowsData.push({id: 'people', title: 'People', items: getVisibleItems(items.people, 'people'), totalCount: items.people.length});
		return rowsData;
	}, [items, getVisibleItems]);

	const loadMoreItems = useCallback((rowId) => {
		setDisplayCounts(prev => ({
			...prev,
			[rowId]: (prev[rowId] || ITEMS_PER_PAGE) + ITEMS_PER_PAGE
		}));
	}, []);

	const loadItems = useCallback(async () => {
		setIsLoading(true);
		try {
			const result = await api.getItems({
				Filters: 'IsFavorite',
				Recursive: true,
				IncludeItemTypes: 'Movie,Series,Episode',
				Fields: 'PrimaryImageAspectRatio,ProductionYear,ParentIndexNumber,IndexNumber,SeriesName'
			});

			const allItems = result.Items || [];
			const categorized = {
				movies: allItems.filter(item => item.Type === 'Movie'),
				shows: allItems.filter(item => item.Type === 'Series'),
				episodes: allItems.filter(item => item.Type === 'Episode'),
				people: []
			};

			const peopleResult = await api.getItems({
				Filters: 'IsFavorite',
				IncludeItemTypes: 'Person',
				Fields: 'PrimaryImageAspectRatio'
			});
			categorized.people = peopleResult.Items || [];

			setItems(categorized);
		} catch (err) {
			console.error('Failed to load favorites:', err);
		} finally {
			setIsLoading(false);
		}
	}, [api]);

	useEffect(() => {
		loadItems();
	}, [loadItems]);

	const handleCardClick = useCallback((ev) => {
		const itemId = ev.currentTarget?.dataset?.itemId;
		const itemType = ev.currentTarget?.dataset?.itemType;
		if (!itemId) return;

		const allItems = [...items.movies, ...items.shows, ...items.episodes, ...items.people];
		const item = allItems.find(i => i.Id === itemId);

		if (item) {
			if (itemType === 'Person') {
				onSelectPerson?.(item);
			} else {
				onSelectItem?.(item);
			}
		}
	}, [items, onSelectItem, onSelectPerson]);

	const handleRowFocus = useCallback((rowId, totalCount) => {
		return () => {
			const scroller = scrollerRefs.current[rowId];
			if (scroller) {
				const focusedElement = Spotlight.getCurrent();
				if (focusedElement && scroller.contains(focusedElement)) {
					const visibleCount = displayCounts[rowId] || ITEMS_PER_PAGE;
					if (visibleCount < totalCount) {
						loadMoreItems(rowId);
					}
				}
			}
		};
	}, [displayCounts, loadMoreItems]);

	useEffect(() => {
		const handleKeyDown = (e) => {
			if (isBackKey(e)) {
				onBack?.();
			}
		};
		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [onBack]);

	const renderCard = useCallback((item, index, rowId) => {
		const isPerson = item.Type === 'Person';
		const isEpisode = item.Type === 'Episode';
		const imageId = getPrimaryImageId(item);
		const imageUrl = imageId ? getImageUrl(serverUrl, imageId, 'Primary') : null;

		let subtitle = '';
		if (isEpisode) {
			subtitle = `${item.SeriesName || ''} S${item.ParentIndexNumber || '?'}E${item.IndexNumber || '?'}`;
		} else if (isPerson) {
			subtitle = 'Person';
		} else {
			subtitle = item.ProductionYear || '';
		}

		return (
			<SpottableDiv
				key={item.Id}
				className={`${css.card} ${isPerson ? css.personCard : ''} ${isEpisode ? css.episodeCard : ''}`}
				onClick={handleCardClick}
				data-item-id={item.Id}
				data-item-type={item.Type}
				spotlightId={`${rowId}-item-${index}`}
			>
				<div className={`${css.cardImageWrapper} ${isPerson ? css.personImageWrapper : ''} ${isEpisode ? css.episodeImageWrapper : ''}`}>
					{imageUrl ? (
						<ProxiedImage
							className={`${css.cardImage} ${isPerson ? css.personImage : ''}`}
							src={imageUrl}
							alt={item.Name}
						/>
					) : (
						<div className={css.cardPlaceholder}>
							<svg viewBox="0 0 24 24" className={css.placeholderIcon}>
								<path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
							</svg>
						</div>
					)}
				</div>
				<div className={css.cardTitle}>{item.Name}</div>
				{subtitle && <div className={css.cardSubtitle}>{subtitle}</div>}
			</SpottableDiv>
		);
	}, [serverUrl, handleCardClick]);

	return (
		<div className={css.page}>
			<div className={css.pageHeader}>
				<h1 className={css.title}>Favorites</h1>
			</div>

			<div className={css.favoritesResults}>
				{isLoading ? (
					<div className={css.loading}>
						<LoadingSpinner />
					</div>
				) : rows.length === 0 ? (
					<div className={css.empty}>
						<div className={css.emptyIcon}>
							<svg viewBox="0 0 24 24">
								<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
							</svg>
						</div>
						<div className={css.emptyText}>No favorites yet</div>
					</div>
				) : (
					rows.map((row) => (
						<div key={row.id} className={css.resultRow}>
							<RowContainer spotlightId={`row-${row.id}`}>
								<h2 className={css.rowTitle}>
									{row.title}
									{row.items.length < row.totalCount && (
										<span className={css.loadMore}> (Showing {row.items.length} of {row.totalCount})</span>
									)}
								</h2>
								<div
									className={css.rowScroller}
									ref={(el) => {scrollerRefs.current[row.id] = el;}}
									onFocus={handleRowFocus(row.id, row.totalCount)}
								>
									<div className={css.resultItems}>
										{row.items.map((item, index) => renderCard(item, index, row.id))}
									</div>
								</div>
							</RowContainer>
						</div>
					))
				)}
			</div>
		</div>
	);
};

export default Favorites;
