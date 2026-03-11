# -*- encoding: utf-8 -*-
"""
Copyright (c) 2019 - present AppSeed.us
"""

import os, json, pprint
import wtforms
from datetime import date
from sqlalchemy import cast, Integer

from apps.home import blueprint
from flask import render_template, request, redirect, url_for
from flask_login import login_required
from jinja2 import TemplateNotFound
from flask_login import login_required, current_user
from apps import db, config
from apps.models import *
from apps.tasks import *
from apps.authentication.models import Users
from flask_wtf import FlaskForm

@blueprint.route('/')
@blueprint.route('/index')
def index():
    hot_topics_limit = request.args.get('hot_topics_limit', 3, type=int)
    if hot_topics_limit < 1:
        hot_topics_limit = 1
    if hot_topics_limit > 10:
        hot_topics_limit = 10

    def month_add(base: date, delta_months: int) -> date:
        year = base.year + (base.month - 1 + delta_months) // 12
        month = (base.month - 1 + delta_months) % 12 + 1
        return date(year, month, 1)

    kpis = {
        'total_news': 11105,
        'news_last_7_days': [1320, 1450, 1380, 1605, 1540, 1710, 2100],
        'global_sentiment': 0.82,
        'hot_topics': [
            {'keyword': '土地承包', 'count': 342},
            {'keyword': '专项债', 'count': 278},
            {'keyword': '乡村振兴', 'count': 221},
        ],
    }

    try:
        max_publish_date = db.session.query(db.func.max(LandNewsAnalysis.publish_date)).scalar()
        if max_publish_date:
            end_month = date(max_publish_date.year, max_publish_date.month, 1)
            start_month = month_add(end_month, -5)
            next_month = month_add(end_month, 1)

            dialect = None
            if db.session.bind and getattr(db.session.bind, "dialect", None):
                dialect = db.session.bind.dialect.name

            if dialect == 'mysql':
                month_key_expr = db.func.date_format(LandNewsAnalysis.publish_date, '%Y-%m')
            elif dialect == 'sqlite':
                month_key_expr = db.func.strftime('%Y-%m', LandNewsAnalysis.publish_date)
            elif dialect == 'postgresql':
                month_key_expr = db.func.to_char(LandNewsAnalysis.publish_date, 'YYYY-MM')
            else:
                month_key_expr = None

            month_to_avg = {}
            if month_key_expr is not None:
                rows = (
                    db.session.query(
                        month_key_expr.label('month'),
                        db.func.avg(LandNewsAnalysis.sentiment_score).label('avg_score'),
                    )
                    .filter(LandNewsAnalysis.publish_date >= start_month)
                    .filter(LandNewsAnalysis.publish_date < next_month)
                    .group_by('month')
                    .order_by('month')
                    .all()
                )
                for row in rows:
                    month_to_avg[str(row.month)] = float(row.avg_score) if row.avg_score is not None else None
            else:
                rows = (
                    db.session.query(LandNewsAnalysis.publish_date, LandNewsAnalysis.sentiment_score)
                    .filter(LandNewsAnalysis.publish_date >= start_month)
                    .filter(LandNewsAnalysis.publish_date < next_month)
                    .all()
                )
                buckets = {}
                counts = {}
                for publish_date, sentiment_score in rows:
                    if not publish_date or sentiment_score is None:
                        continue
                    key = f"{publish_date.year:04d}-{publish_date.month:02d}"
                    buckets[key] = buckets.get(key, 0.0) + float(sentiment_score)
                    counts[key] = counts.get(key, 0) + 1
                for key, total in buckets.items():
                    cnt = counts.get(key) or 0
                    month_to_avg[key] = (total / cnt) if cnt else None

            avg_last_6_months = (
                db.session.query(db.func.avg(LandNewsAnalysis.sentiment_score))
                .filter(LandNewsAnalysis.publish_date >= start_month)
                .filter(LandNewsAnalysis.publish_date < next_month)
                .scalar()
            )

            labels = []
            series = []
            current = start_month
            for _ in range(6):
                key = f"{current.year:04d}-{current.month:02d}"
                labels.append(key)
                series.append(month_to_avg.get(key))
                current = month_add(current, 1)

            kpis['avg_sentiment_last_6_months_labels'] = labels
            kpis['avg_sentiment_last_6_months'] = series
            kpis['avg_sentiment_last_6_months_overall'] = float(avg_last_6_months) if avg_last_6_months is not None else None
    except Exception:
        pass

    try:
        dialect = None
        if db.session.bind and getattr(db.session.bind, "dialect", None):
            dialect = db.session.bind.dialect.name

        year_expr = None
        month_expr = None
        if dialect == 'mysql':
            year_expr = db.func.year(LandNewsAnalysis.publish_date)
            month_expr = db.func.month(LandNewsAnalysis.publish_date)
        elif dialect == 'sqlite':
            year_expr = cast(db.func.strftime('%Y', LandNewsAnalysis.publish_date), Integer)
            month_expr = cast(db.func.strftime('%m', LandNewsAnalysis.publish_date), Integer)
        elif dialect == 'postgresql':
            year_expr = cast(db.func.extract('year', LandNewsAnalysis.publish_date), Integer)
            month_expr = cast(db.func.extract('month', LandNewsAnalysis.publish_date), Integer)

        year_to_series = {}
        years = []

        if year_expr is not None and month_expr is not None:
            bimonth_expr = db.func.floor((month_expr - 1) / 2) + 1
            rows = (
                db.session.query(
                    year_expr.label('year'),
                    bimonth_expr.label('bimonth'),
                    db.func.avg(LandNewsAnalysis.sentiment_score).label('avg_score'),
                )
                .filter(LandNewsAnalysis.publish_date.isnot(None))
                .filter(LandNewsAnalysis.sentiment_score.isnot(None))
                .group_by('year', 'bimonth')
                .order_by('year', 'bimonth')
                .all()
            )
            for row in rows:
                year_val = int(row.year)
                if year_val not in year_to_series:
                    year_to_series[year_val] = [None, None, None, None, None, None]
                idx = int(row.bimonth) - 1
                if 0 <= idx < 6:
                    year_to_series[year_val][idx] = float(row.avg_score) if row.avg_score is not None else None
        else:
            rows = (
                db.session.query(LandNewsAnalysis.publish_date, LandNewsAnalysis.sentiment_score)
                .filter(LandNewsAnalysis.publish_date.isnot(None))
                .filter(LandNewsAnalysis.sentiment_score.isnot(None))
                .all()
            )
            buckets = {}
            counts = {}
            for publish_date, sentiment_score in rows:
                year_val = publish_date.year
                bimonth = ((publish_date.month - 1) // 2) + 1
                key = (year_val, bimonth)
                buckets[key] = buckets.get(key, 0.0) + float(sentiment_score)
                counts[key] = counts.get(key, 0) + 1

            for (year_val, bimonth), total in buckets.items():
                if year_val not in year_to_series:
                    year_to_series[year_val] = [None, None, None, None, None, None]
                idx = int(bimonth) - 1
                cnt = counts.get((year_val, bimonth)) or 0
                if 0 <= idx < 6 and cnt:
                    year_to_series[year_val][idx] = total / cnt

        if year_to_series:
            years = sorted(year_to_series.keys())
            kpis['sentiment_years'] = years
            kpis['default_sentiment_year'] = years[-1]
            kpis['sentiment_by_year_bimonth'] = {str(y): year_to_series[y] for y in years}
    except Exception:
        pass

    try:
        latest_created_at = db.session.query(db.func.max(WordFrequencyStat.created_at)).scalar()
        query = WordFrequencyStat.query
        if latest_created_at:
            query = query.filter(WordFrequencyStat.created_at == latest_created_at)

        rows = query.order_by(WordFrequencyStat.count.desc()).limit(hot_topics_limit).all()
        hot_topics = [{'keyword': row.word, 'count': int(row.count or 0)} for row in rows]

        while len(hot_topics) < 3:
            hot_topics.append({'keyword': '-', 'count': 0})

        if hot_topics:
            kpis['hot_topics'] = hot_topics
    except Exception:
        pass

    return render_template('pages/index.html', segment='index', kpis=kpis)

@blueprint.route('/icon_feather')
def icon_feather():
    return render_template('pages/icon-feather.html', segment='icon_feather')

@blueprint.route('/color')
def color():
    return render_template('pages/color.html', segment='color')

@blueprint.route('/sample_page')
def sample_page():
    return render_template('pages/sample-page.html', segment='sample_page')

@blueprint.route('/typography')
def typography():
    return render_template('pages/typography.html', segment='typography')

def getField(column): 
    if isinstance(column.type, db.Text):
        return wtforms.TextAreaField(column.name.title())
    if isinstance(column.type, db.String):
        return wtforms.StringField(column.name.title())
    if isinstance(column.type, db.Boolean):
        return wtforms.BooleanField(column.name.title())
    if isinstance(column.type, db.Integer):
        return wtforms.IntegerField(column.name.title())
    if isinstance(column.type, db.Float):
        return wtforms.DecimalField(column.name.title())
    if isinstance(column.type, db.LargeBinary):
        return wtforms.HiddenField(column.name.title())
    return wtforms.StringField(column.name.title()) 


@blueprint.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():

    class ProfileForm(FlaskForm):
        pass

    readonly_fields = Users.readonly_fields
    full_width_fields = {"bio"}

    for column in Users.__table__.columns:
        if column.name == "id":
            continue

        field_name = column.name
        if field_name in full_width_fields:
            continue

        field = getField(column)
        setattr(ProfileForm, field_name, field)

    for field_name in full_width_fields:
        if field_name in Users.__table__.columns:
            column = Users.__table__.columns[field_name]
            field = getField(column)
            setattr(ProfileForm, field_name, field)

    form = ProfileForm(obj=current_user)

    if form.validate_on_submit():
        readonly_fields.append("password")
        excluded_fields = readonly_fields
        for field_name, field_value in form.data.items():
            if field_name not in excluded_fields:
                setattr(current_user, field_name, field_value)

        db.session.commit()
        return redirect(url_for('home_blueprint.profile'))
    
    context = {
        'segment': 'profile',
        'form': form,
        'readonly_fields': readonly_fields,
        'full_width_fields': full_width_fields,
    }
    return render_template('pages/profile.html', **context)


# Helper - Extract current page name from request
def get_segment(request):

    try:

        segment = request.path.split('/')[-1]

        if segment == '':
            segment = 'index'

        return segment

    except:
        return None

@blueprint.route('/error-403')
def error_403():
    return render_template('error/403.html'), 403

@blueprint.errorhandler(403)
def not_found_error(error):
    return redirect(url_for('error-403'))

@blueprint.route('/error-404')
def error_404():
    return render_template('error/404.html'), 404

@blueprint.errorhandler(404)
def not_found_error(error):
    return redirect(url_for('error-404'))

@blueprint.route('/error-500')
def error_500():
    return render_template('error/500.html'), 500

@blueprint.errorhandler(500)
def not_found_error(error):
    return redirect(url_for('error-500'))

# Celery (to be refactored)
@blueprint.route('/tasks-test')
def tasks_test():
    
    input_dict = { "data1": "04", "data2": "99" }
    input_json = json.dumps(input_dict)

    task = celery_test.delay( input_json )

    return f"TASK_ID: {task.id}, output: { task.get() }"


# Custom template filter

@blueprint.app_template_filter("replace_value")
def replace_value(value, arg):
    return value.replace(arg, " ").title()
